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

const objEntries = Object.entries;

const modObjToStr = (paramModifiers, isParameter = true) => {
  return objEntries(paramModifiers)
    .map(([key, { value }]) => `${key}=${value}`)
    .join(isParameter ? ";" : ",");
};

const insertModifiers = ({ value, modifiers }) => {
  return objEntries(modifiers)
    .filter(([key]) => value.includes(key))
    .reduce((modValue, [key, modSubkeys]) => {
      const joiner = `${key}(${modObjToStr(modSubkeys)})`;
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
        ? `(${modObjToStr(modifiers, isParameter)})`
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

  constructor({
    url,
    company,
    username,
    password,
    langId,
    file = "tabula.ini",
  }) {
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
          return `${key}${value[0]}'${value[1]}'`;
        }
        return `${key}${equator}'${value}'`;
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
   *
   * @param {string} screenName the screen to get the resources from PRIORITY
   */
  screen(screenName) {
    this.#addToParamTree("screen", { value: screenName });
    return this;
  }

  /**
   *
   * @param {string} subformName the subform to get the resources from PRIORITY
   */
  subform(subformName) {
    this.#addToParamTree("subform", { value: subformName });
    return this;
  }

  /**
   *
   * @param {{[key: string]: string}} identifier
   * @returns
   */
  findOne(identifier) {
    const parent = this.#paramTree.subform ? "subform" : "screen";
    objEntries(identifier).map(([key, value]) => {
      this.#addToParamTree(key, { value }, parent);
    });
    return this;
  }

  /**
   *
   * @param {{[key: string]: string|[equator: string, value:string]}} filters
   * @returns
   */
  where(filters) {
    const value = this.#convertObjectToString(filters, "+eq+", "+and+");
    this.#addToParamTree("$filter", { value });
    return this;
  }

  /**
   *
   * @param {string[]} subforms An array of the screens related subform to include with the main screeen's data
   * @returns
   */
  withRelated(subforms) {
    this.#addToParamTree("$expand", { value: subforms.join(",") });
    return this;
  }

  /**
   *
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
   *
   * @param {date} time Time to start from
   */
  since(time) {
    this.#addToParamTree("$since", { value: time });
    return this;
  }

  /**
   *
   * @param {string} field Field used to order entities fetched
   * @param {'desc'|'asc'} order The order to fetch items
   */
  orderBy(field, order) {
    this.#addToParamTree("$orderBy", { value: `${field}+${order}` });
    return this;
  }

  /**
   *
   * @param {number} page The page to be fetched
   * @param {number} size The number of items in that page
   * @returns
   */
  async paginate(page = 1, size = 20) {
    const offset = (page - 1) * size;
    this.#addToParamTree("$top", { value: size });
    this.#addToParamTree("$skip", { value: offset });
    const response = await fetch(this.url, this.config);
    return response.value;
  }

  /**
   *
   * @param {number} page The page to be fetched
   * @param {number} size The number of items in that page
   * @param {(items, page) => Promise<void>} callback The callback to process the paginated data
   * @param {number} [limit=Infinity] The total number of items to fetch
   * @returns {Promise<void>}
   */
  async paginateAction(page, size, callback, limit = Infinity) {
    let data = [];
    let totalLength = 0;
    do {
      data = await this.paginate(page, size);
      totalLength += data.length;
      console.log(`PAGE::${page} SIZE::${size} RESPONSE SIZE::${data.length}`);
      await callback(data, page);
    } while (data.length && totalLength < limit);
  }

  /**
   *
   * @param {number} page The page to be fetched
   * @param {number} size The number of items in that page
   * @param {number} [limit=Infinity] The total number of items to fetch
   * @returns {Promise<any[]>}
   */
  async paginateAndCollect(page, size, limit = Infinity) {
    const data = [];
    let totalLength = 0;
    do {
      const response = await this.paginate(page, size);
      data.push(...response);
      totalLength += data.length;
      console.log(
        `PAGE::${page} SIZE::${size} RESPONSE SIZE::${response.length}`
      );
      page++;
    } while (data.length && totalLength < limit);
    return data;
  }

  /**
   *
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

  get #config() {
    let Authorization = `Basic ${this.#auth}`;
    const headers = { Authorization, "Content-Type": "application/json" };
    return { method: this.#method, headers, data: this.#data };
  }

  get #url() {
    return new URL(urlObjToStr(this.#paramTree, this.#baseUrl)).toString();
  }

  async get() {
    return this.#request();
  }

  async post(data) {
    return this.#request("POST", data);
  }

  async patch(data) {
    return this.#request("PATCH", data);
  }

  async #request(method = "GET", data = null) {
    this.#method = method;
    this.#data = data;
    const response = await fetch(this.#url, this.#config);
    this.#reset();
    return response;
  }

  debug() {
    console.log({ url: this.#url, ...this.#config });
    return this;
  }
}

module.exports = PriorityQueryBuilder;