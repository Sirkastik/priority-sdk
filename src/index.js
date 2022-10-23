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

  #convertObjectToString(object, equator, joiner) {
    return Object.entries(object)
      .map(([key, value]) => `${key}${equator}'${value}'`)
      .join(joiner);
  }

  #appendParamToUrl(paramClause) {
    const paramPrefix = this.#url.includes("?") ? "&" : "?";
    this.#appendToUrl(paramPrefix, paramClause);
  }

  /**
   *
   * @param {string} screenName the screen to get the resources from PRIORITY
   */
  screen(screenName) {
    this.#appendToUrl("/", screenName);
    return this;
  }

  where(whereObject) {
    const whereClause = this.#convertObjectToString(whereObject, "=", ",");
    whereClause && this.#appendToUrl("(", whereClause, ")");
    return this;
  }

  filter(filterObject) {
    const filters = this.#convertObjectToString(
      filterObject,
      "+eq+",
      "+and+"
    );
    filters && this.#appendParamToUrl(`$filter=${filters}`);
    return this;
  }

  /**
   *
   * @param {string} subformName The name of the screen's subform to include with the main screeen's data
   * @returns
   */
  include(subformName) {
    this.#insideSubform = true;
    this.#appendParamToUrl(`$expand=${subformName}`);
    return this;
  }

  #subselect(selectClause) {
    this.#appendToUrl("($select=", selectClause, ")");
    return this;
  }

  #mainselect(selectClause) {
    this.#appendParamToUrl(`$select=${selectClause}`);
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
// 1.create 'findOne()' method to fetch one entity. It should replace 'where()'
// 2.create 'where()' method to fetch multple entities. It should replace 'filter()'...
// ...It can take an object that'll be converted to a query param or [key, equator, value] e.g ('PRICE', 'lt', '50') 
// 3.create 'with()' method to fetch related entities(subforms). It should replace 'include'
// 4.create 'since()' method to fetch entities from the provided timestamp
// 5.create 'orderBy()' method to sort the entities fetched
// 6.create 'paginate()' method to fetch smaller number of entities at a time
// *7.Also... change to existing snake_case naming to camelCase - DONE✔️

export default PriorityClient;
