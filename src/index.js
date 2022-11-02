const axios = require("axios");

const fetch = async (url, config) => {
  try {
    const response = await axios({ url, ...config });
    return response.data;
  } catch (error) {
    if (!error) throw new Error("An Error Occurred");
    throw error;
  }
};

const checkUndefined = (...args) => {
  return args.some((arg) => arg === undefined);
};

const denoteString = (val) => (typeof val === "string" ? `'${val}'` : val);

const objEntries = Object.entries;

const modifierObjectToString = (paramModifiers, isParameter = true) => {
  return objEntries(paramModifiers)
    .map(([key, { value }]) => `${key}=${value}`)
    .join(isParameter ? ";" : ",");
};

const insertModifiers = ({ value, modifiers }) => {
  return objEntries(modifiers)
    .filter(([key]) => value.includes(key))
    .reduce((modValue, [key, modifiyingClause]) => {
      const joiner = `${key}(${modifierObjectToString(modifiyingClause)})`;
      return modValue.split(key).join(joiner);
    }, value);
};

const urlObjToStr = (paramObj, baseUrl) => {
  return objEntries(paramObj).reduce((url, [key, { value, modifiers }]) => {
    const isParameter = key.includes("$");
    if (!isParameter) {
      url += "/";
      url += value;
      if (!modifiers) return url;
      const _value = modifiers
        ? `(${modifierObjectToString(modifiers, isParameter)})`
        : "";
      url += _value;
    } else {
      url += url.includes("?") ? "&" : "?";
      url += key;
      url += "=";
      if (key === "$expand" && modifiers) {
        url += insertModifiers({ value, modifiers });
      } else {
        url += value;
      }
    }
    return url;
  }, baseUrl);
};

class PriorityQueryBuilder {
  #baseUrl = "";
  #auth = "";
  #method = "GET";
  #data = null;
  #paramTree = {};
  #modifiedKey = null;

  /**
   *
   * Integration Config Object
   * @typedef {Object} Config
   * @property {string} url - The url
   * @property {string} company - The company short name
   * @property {string} username - The username required for auth
   * @property {string} password - The password required for auth
   * @property {number} langId - The language id
   * @property {string} [file='tabula.ini'] - The filename: defaults to 'tabula.ini'
   *
   * @param {Config} configuration The credentials for accessing Priority as well as the options
   */
  constructor({
    url,
    company,
    username,
    password,
    langId,
    file = "tabula.ini",
  }) {
    if (checkUndefined(url, company, username, password))
      throw Error("Please pass the necessary input");
    const lang = langId ? `,${langId}` : "";
    this.#baseUrl = `${url}/odata/Priority/${file}${lang}/${company}`;
    this.#auth = Buffer.from(`${username}:${password}`).toString("base64");
  }

  #reset() {
    this.#paramTree = {};
    this.#method = "GET";
    this.#data = null;
    this.#modifiedKey = null;
  }

  /**
   *
   * @param {{[key: string]: any}} object
   * @param {string} equator
   * @param {string} joiner
   * @returns {string}
   */
  #convertObjectToString(object, equator, joiner) {
    return Object.entries(object)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}${value[0]}${denoteString(value[1])}`;
        }
        return `${key}${equator}${denoteString(value)}`;
      })
      .join(joiner);
  }

  #addToParamTree(paramKey, paramObject, parent) {
    if (this.#modifiedKey && !parent) parent = "$expand";
    let target = parent ? this.#paramTree[parent] : this.#paramTree;
    if (parent && !target.modifiers) target.modifiers = {};
    target = parent ? target.modifiers : target;
    if (this.#modifiedKey) {
      if (!target[this.#modifiedKey]) target[this.#modifiedKey] = {};
      target = target[this.#modifiedKey];
    }
    target[paramKey] = paramObject;
  }

  /**
   * Method to choose the screen where the resources are fetched
   * @param {string} screenName the screen to get the resources from PRIORITY
   */
  screen(screenName) {
    this.#reset();
    this.#addToParamTree("screen", { value: screenName });
    return this;
  }

  /**
   * Method to select a subform that exists inside the already chosen screeen
   * @param {string} subformName the subform to get the resources from PRIORITY
   */
  subform(subformName) {
    this.#addToParamTree("subform", { value: subformName });
    return this;
  }

  /**
   * Method to fetch one entity from the related collection
   * @param {{[key: string]: string}} identifier
   * @returns
   */
  findOne(identifier) {
    const parent = this.#paramTree.subform ? "subform" : "screen";
    objEntries(identifier).map(([key, value]) => {
      this.#addToParamTree(key, { value: denoteString(value) }, parent);
    });
    return this;
  }

  /**
   * Method to filter entities that match the filters in the collection
   * @param {{[key: string]: string|[equator: string, value:string]}} filters
   * @returns
   */
  where(filters) {
    const value = this.#convertObjectToString(filters, "+eq+", "+and+");
    this.#addToParamTree("$filter", { value });
    return this;
  }

  /**
   * Method to include subforms inside the collection data
   * @param {string[]} subforms An array of the screens related subform to include with the main screeen's data
   * @returns
   */
  withRelated(subforms) {
    this.#addToParamTree("$expand", { value: subforms.join(",") });
    return this;
  }

  /**
   * Method to modify a subform that was included in the URL
   * @param {string} subformName The name of the subform to be modified
   * @param {(queryBuilder: this) => void} modifierFunction The function insert a subquery for the related subform
   * @returns {this}
   */
  modifyRelated(subformName, modifierFunction) {
    this.#modifiedKey = subformName;
    modifierFunction.bind(this)(this);
    this.#modifiedKey = null;
    return this;
  }

  /**
   * Method to select the fields fetched in the collection
   * @param {string[]} fieldsToSelect field names to select from the resource object
   * @returns
   */
  select(fieldsToSelect) {
    if (!fieldsToSelect.length) return this;
    const value = fieldsToSelect.join(",");
    this.#addToParamTree("$select", { value });
    return this;
  }

  /**
   * Method to fetch items created after a certain date
   * @param {date} time Time to start from
   */
  since(time) {
    this.#addToParamTree("$since", { value: time });
    return this;
  }

  /**
   * Method to sort the entities
   * @param {string} field Field used to order entities fetched
   * @param {'desc'|'asc'} order The order to fetch items
   */
  orderBy(field, order) {
    this.#addToParamTree("$orderBy", { value: `${field}+${order}` });
    return this;
  }

  /**
   * Method to paginate the response from the API
   * @param {number} page The page to be fetched
   * @param {number} size The number of items in that page
   * @returns
   */
  async paginate(page = 1, size = 20) {
    const offset = (page - 1) * size;
    this.#addToParamTree("$top", { value: size });
    this.#addToParamTree("$skip", { value: offset });
    const response = await fetch(this.url, this.#config);
    return response.value;
  }

  /**
   * Method to fetch collection in pages and process the data using a callback for every page
   * @param {number} page The page to be fetched
   * @param {number} size The number of items in that page
   * @param {(items, page) => Promise<void>} callback The callback to process the paginated data
   * @param {number} [limit=Infinity] The total number of items to fetch
   * @returns {Promise<number>}
   */
  async paginateAction(page, size, callback, limit = Infinity) {
    let data = [];
    let totalLength = 0;
    do {
      data = await this.paginate(page, size);
      totalLength += data.length;
      await callback(data, page);
    } while (data.length && totalLength < limit);
    return totalLength;
  }

  get #config() {
    const Authorization = `Basic ${this.#auth}`;
    const headers = { Authorization, "Content-Type": "application/json" };
    return { method: this.#method, headers, data: this.#data };
  }

  get url() {
    return new URL(urlObjToStr(this.#paramTree, this.#baseUrl)).toString();
  }

  async get() {
    return this.request();
  }

  async post(data) {
    return this.request("POST", data);
  }

  async patch(data) {
    return this.request("PATCH", data);
  }

  /**
   *
   * @param {string} [method='GET'] The request method
   * @param {string} [data] The request body
   * @returns {Promise<any>}
   */
  async request(method = "GET", data = null) {
    this.#method = method;
    this.#data = data;
    const response = await fetch(this.url, this.#config);
    this.#reset();
    return response;
  }

  /**
   * Method to debug the URL query string created. It logs the object
   * @returns this
   */
  debug() {
    console.log({ url: this.url, ...this.#config });
    console.log(
      require("util").inspect(
        require("util").inspect(this.#paramTree, false, null, true),
        false,
        null,
        true
      )
    );
    return this;
  }
}

module.exports = PriorityQueryBuilder;
