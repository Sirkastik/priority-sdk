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
  #inside_subform = false;
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
    this.#inside_subform = false;
    this.#method = "GET";
    this.#data = null;
  }

  /**
   *
   * @param  {...string} suffixes strings to append to url
   */
  #append_to_url(...suffixes) {
    this.#url = suffixes.reduce((extension, suffix) => {
      return extension + suffix;
    }, this.#url);
  }

  #convert_object_to_string(object, equator, joiner) {
    return Object.entries(object)
      .map(([key, value]) => `${key}${equator}'${value}'`)
      .join(joiner);
  }

  #append_param_to_url(param_clause) {
    const param_prefix = this.#url.includes("?") ? "&" : "?";
    this.#append_to_url(param_prefix, param_clause);
  }

  /**
   *
   * @param {string} screen_name the screen to get the resources from PRIORITY
   */
  screen(screen_name) {
    this.#append_to_url("/", screen_name);
    return this;
  }

  where(where_object) {
    const where_clause = this.#convert_object_to_string(where_object, "=", ",");
    where_clause && this.#append_to_url("(", where_clause, ")");
    return this;
  }

  filter(filter_object) {
    const filters = this.#convert_object_to_string(
      filter_object,
      "+eq+",
      "+and+"
    );
    filters && this.#append_param_to_url(`$filter=${filters}`);
    return this;
  }

  /**
   *
   * @param {string} subform_name The name of the screen's subform to include with the main screeen's data
   * @returns
   */
  include(subform_name) {
    this.#inside_subform = true;
    this.#append_param_to_url(`$expand=${subform_name}`);
    return this;
  }

  #subselect(select_clause) {
    this.#append_to_url("($select=", select_clause, ")");
    return this;
  }

  #mainselect(select_clause) {
    this.#append_param_to_url(`$select=${select_clause}`);
    return this;
  }

  /**
   *
   * @param {string[]} selected_fields field names to select from the resource object
   * @returns
   */
  select(selected_fields) {
    if (!selected_fields.length) return this;
    const select_clause = selected_fields.join(",");
    this.#inside_subform
      ? this.#subselect(select_clause)
      : this.#mainselect(select_clause);
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

export default PriorityClient;
