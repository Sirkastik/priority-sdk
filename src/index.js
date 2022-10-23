const fetch = async (url, config) => {
  try {
    const response = await require("axios")({ url, ...config });
    return response.data;
  } catch (error) {
    if (!error) throw new Error("An Error Occurred");
    throw error;
  }
};

class PriorityClient {
  #base_url = "";
  #auth = "";
  #insideSubform = false;
  #url = "";
  #method = "GET";
  #data = null;

  constructor({ url, company, username, password }) {
    this.#base_url = `${url}/odata/Priority/tabula.ini/${company}`;
    this.#auth = Buffer.from(`${username}:${password}`).toString("base64");
    this.#url = this.#base_url;
  }

  #reset() {
    this.#url = this.#base_url;
    this.#insideSubform = false;
    this.#method = "GET";
    this.#data = null;
  }

  /**
   *
   * @param  {...string} suffixes strings to append to url
   */
  #appendToUrl(...suffixes) {
    this.#url = suffixes.reduce((extension, suffix) => {
      return extension + suffix;
    }, this.#url);
  }

  /**
   *
   * @param  {...string} params param strings to append to url
   */
  #appendParamToUrl(...params) {
    const prefix = this.#url.includes("?") ? "&" : "?";
    this.#appendToUrl(prefix, ...params);
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

  /**
   *
   * @param {string} screenName the screen to get the resources from PRIORITY
   */
  screen(screenName) {
    this.#appendToUrl("/", screenName);
    return this;
  }

  /**
   *
   * @param {string} subformName the subform to get the resources from PRIORITY
   */
  subform(subformName) {
    this.#appendToUrl("/", subformName);
    return this;
  }

  /**
   *
   * @param {{[key: string]: string}} identifier
   * @returns
   */
  findOne(identifier) {
    const searchClause = this.#convertObjectToString(identifier, "=", ",");
    searchClause && this.#appendToUrl("(", searchClause, ")");
    return this;
  }

  /**
   *
   * @param {{[key: string]: string|[equator: string, value:string]}} filters
   * @returns
   */
  where(filters) {
    const whereClause = this.#convertObjectToString(filters, "+eq+", "+and+");
    whereClause && this.#appendParamToUrl("$filter=", whereClause);
    return this;
  }

  /**
   *
   * @param {string} subformName The name of the screen's related subform to include with the main screeen's data
   * @returns
   */
  withRelated(subformName) {
    this.#insideSubform = true;
    this.#appendParamToUrl("$expand=", subformName);
    return this;
  }

  #subselect(selectClause) {
    this.#appendParamToUrl("($select=", selectClause, ")");
    return this;
  }

  #mainselect(selectClause) {
    this.#appendParamToUrl("$select=", selectClause);
    return this;
  }

  /**
   *
   * @param {string[]} fieldsToSelect field names to select from the resource object
   * @returns
   */
  select(fieldsToSelect) {
    if (!fieldsToSelect.length) return this;
    const selectClause = fieldsToSelect.join(",");
    this.#insideSubform
      ? this.#subselect(selectClause)
      : this.#mainselect(selectClause);
    return this;
  }

  /**
   *
   * @param {date} time Time to start from
   */
  since(time) {
    this.#appendParamToUrl("$since=", time);
    return this;
  }

  /**
   *
   * @param {string} field Field used to order entities fetched
   * @param {'desc'|'asc'} order The order to fetch items
   */
  orderBy(field, order) {
    this.#appendParamToUrl("$orderBy=", `${field} ${order}`);
    return this;
  }

  /**
   *
   * @param {number} page The page to be fetched
   * @param {number} size The number of items in that page
   * @returns
   */
  paginate(page = 1, size = 20) {
    const offset = page - 1 * size;
    this.#appendToUrl(`$top=${size}`);
    this.#appendToUrl(`$skip=${offset}`);
    return this;
  }

  get config() {
    let Authorization = `Basic ${this.#auth}`;
    const headers = { Authorization, "Content-Type": "application/json" };
    return { method: this.#method, headers, data: this.#data };
  }

  get url() {
    return new URL(this.#url).toString();
  }

  async get() {
    const response = await fetch(this.url, this.config);
    this.#reset();
    return response;
  }

  async post(data) {
    this.#method = "POST";
    this.#data = data;
    const response = await fetch(this.url, this.config);
    this.#reset();
    return response;
  }

  async patch(data) {
    this.#method = "PATCH";
    this.#data = data;
    const response = await fetch(this.url, this.config);
    this.#reset();
    return response;
  }

  debug() {
    console.log({ url: this.url, ...this.config });
    return this;
  }
}

// *Idea: use Knex query interface as inspiration for the chaining methods
// TODO
// *1.create 'findOne()' method to fetch one entity. It should replace 'where()' - DONE✔️
// *2.create 'where()' method to fetch multple entities. It should replace 'filter()' - DONE✔️
// *3.create 'withRelated()' method to fetch related entities(subforms). It should replace 'include' - DONE✔️
// *4.create 'since()' method to fetch entities from the provided timestamp - DONE✔️
// *5.create 'orderBy()' method to sort the entities fetched - DONE✔️
// *6.create 'paginate()' method to fetch smaller number of entities at a time - DONE✔️
// *7.Also... change to existing snake_case naming to camelCase - DONE✔️
// *8.Add support for logic operators in 'where()' method - DONE✔️

export default PriorityClient;
