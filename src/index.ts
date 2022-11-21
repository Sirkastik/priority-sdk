import axios from 'axios';

const concat = (...strs: any[]): string => {
  return strs.reduce((concated, str) => concated + str);
};

const isString = <TValue>(value: TValue) => typeof value === 'string';

const assertToString = <TVal>(str: TVal) => (isString(str) ? `'${str}'` : str);

const toString = <TItem, TObj extends { [key: string]: TItem }>(
  o: TObj,
  equator: string,
  joiner: string
) => {
  return Object.entries(o)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return concat(key, value[0], assertToString(value[1]));
      }
      return concat(key, equator, assertToString(value));
    })
    .join(joiner);
};

const modifySubform = (map: Map<string, string>) => (subform: string) => {
  const modifiers: URLSearchParams[] = [];
  map.forEach((value, key) => {
    const [_subform, name] = key.split('::');
    if (key.startsWith('$') || _subform !== subform) return;
    const param = new URLSearchParams();
    param.append(name, value);
    modifiers.push(param);
  });
  const strToInsert = modifiers.length ? `(${modifiers.join(';')})` : '';
  return concat(subform, strToInsert);
};

class Client {
  private baseUrl: string = '';
  private urlPaths: string[] = [];
  private auth: string | null = null;
  private method: string = 'GET';
  private data: any = null;
  private paramTree = new Map<string, string>();
  private targetSubform: string = '';

  constructor(url: string, username: string, password: string) {
    this.baseUrl = url;
    this.auth = Buffer.from(`${username}:${password}`).toString('base64');
  }

  private reset() {
    this.paramTree = new Map();
    this.method = 'GET';
    this.data = null;
    this.targetSubform = '';
    this.urlPaths = [];
  }

  private toKey(key: string) {
    const joiner = this.targetSubform ? '::' : '';
    return concat(this.targetSubform, joiner, key);
  }

  screen(screenName: string) {
    this.reset();
    this.urlPaths.push(concat('/', screenName));
    return this;
  }

  subform(subformName: string) {
    this.urlPaths.push(concat('/', subformName));
    return this;
  }

  findOne(identifier: { [key: string]: string }) {
    this.urlPaths.push(concat('(', toString(identifier, '=', ','), ')'));
    return this;
  }

  where(filters: { [key: string]: string | [string, string | number] }) {
    this.paramTree.set(
      this.toKey('$filter'),
      toString(filters, '+eq+', '+and+')
    );
    return this;
  }

  withRelated(subforms: string[]) {
    this.paramTree.set(this.toKey('$expand'), subforms.join(','));
    return this;
  }

  modifyRelated(
    subformName: string,
    modifierFunction: (queryBuilder: this) => void
  ): this {
    this.targetSubform = subformName;
    modifierFunction.bind(this)(this);
    this.targetSubform = '';
    return this;
  }

  select(fieldsToSelect: string[]) {
    if (!fieldsToSelect.length) return this;
    this.paramTree.set(this.toKey('$select'), fieldsToSelect.join(','));
    return this;
  }

  since(time: string) {
    this.paramTree.set(this.toKey('$since'), time);
    return this;
  }

  orderBy(field: string, order: 'desc' | 'asc') {
    this.paramTree.set(this.toKey('$orderBy'), `${field}+${order}`);
    return this;
  }

  async paginate<TEntitiy>(page: number = 1, size: number = 20) {
    const offset = (page - 1) * size;
    this.paramTree.set(this.toKey('$top'), `${size}`);
    this.paramTree.set(this.toKey('$skip'), `${offset}`);
    const response = await axios<{ value: TEntitiy[] }>(this.url, this.config);
    return response.data.value;
  }

  async paginateAction<TEntitiy>(
    page: number,
    size: number,
    callback: (items: TEntitiy[], page: number) => Promise<any>,
    limit: number = Infinity
  ): Promise<number> {
    let data = [];
    let totalLength = 0;
    do {
      const data = await this.paginate<TEntitiy>(page, size);
      totalLength += data.length;
      await callback(data, page);
    } while (data.length && totalLength < limit);
    return totalLength;
  }

  private get config() {
    const Authorization = `Basic ${this.auth}`;
    const headers = { Authorization, 'Content-Type': 'application/json' };
    return { method: this.method, headers, data: this.data };
  }

  public get url() {
    const url = new URL(concat(this.baseUrl, this.urlPaths.join('')));
    this.paramTree.forEach((param, key, map) => {
      if (!key.startsWith('$')) return;
      const insert = modifySubform(map);
      const isExpand = key === '$expand';
      const value = isExpand
        ? param
            .split(',')
            .map(insert)
            .join(',')
        : param;
      url.searchParams.append(key, value);
    });
    return url.toString();
  }

  async get<TResponse>() {
    return this.request<TResponse>();
  }

  async post<TResponse>(data: any) {
    return this.request<TResponse>('POST', data);
  }

  async patch<TResponse>(data: any) {
    return this.request<TResponse>('PATCH', data);
  }

  async request<TResponse>(
    method: string = 'GET',
    data: any | null = null
  ): Promise<TResponse> {
    this.method = method;
    this.data = data;
    const response = await axios<TResponse>(this.url, this.config);
    this.reset();
    return response.data;
  }
}

export const eq = '+eq+';

export const lt = '+lt+';

export const gt = '+gt+';

export const asc = 'asc';

export const desc = 'desc';

export default Client;
