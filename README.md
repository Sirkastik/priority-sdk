# Priority ERP JavaScript SDK

# Description

This repository serves as a base for code and documentation relating to Priority ERP Development for third parties. It should be used along with the **[documentation](https://prioritysoftware.github.io/restapi/)**.

# Install

```
npm i priority-erp-sdk
```

# Examples

Filtering a collection with logic operators:

```js
const Client = require("priority-erp-sdk");

const apiClient = new Client({ url, username, password });

// URL : {{baseUrl}}/LOGPART?$filter=TYPE eq 'P' and LASTPRICE gt 200

const data = await apiClient
  .screen("LOGPART")
  .where({ TYPE: "P": LASTPRICE: ["gt", 200] })
  .get();
```

Fetch a collection along with its related subform:

```js
const Client = require("priority-erp-sdk");

const apiClient = new Client({ url, username, password });

// URL : {{baseUrl}}/ORDERS?$expand=ORDERITEMS_SUBFORM

const data = await apiClient
  .screen("ORDERS")
  .where({ CUSTNAME: "T000001" })
  .withRelated(["ORDERITEMS_SUBFORM"])
  .get();
```

Paginate a collection:

```js
const Client = require("priority-erp-sdk");

const apiClient = new Client({ url, username, password });

// URL : {{baseUrl}}/LOGPART?$top={{size}}&$skip${{offset}}

const data = await apiClient.screen("LOGPART").paginate(page, size);
```

Combining the operators for a complex query:

```js
const Client = require("priority-erp-sdk");

const apiClient = new Client({ url, username, password });

// URL: {{baseUrl}}/ORDERS?$filter=CUSTNAME+eq+'T000001'&$expand=ORDERITEMS_SUBFORM($filter=PRICE+gt+3;$select=KLINE,PARTNAME,PDES,TQUANT,PRICE;$expand=ORDISTATUSLOG_SUBFORM),SHIPTO2_SUBFORM,ORDERSTEXT_SUBFORM&$select=CUSTNAME,CDES,ORDNAME

const data = await apiClient
  .screen("ORDERS")
  .where({ CUSTNAME: "T000001" })
  .withRelated(["ORDERITEMS_SUBFORM", "SHIPTO2_SUBFORM", "ORDERSTEXT_SUBFORM"])
  .modifyRelated("ORDERITEMS_SUBFORM", (queryBuilder) => {
    queryBuilder
      .where({ PRICE: ["gt", 3] })
      .select(["KLINE", "PARTNAME", "PDES", "TQUANT", "PRICE"])
      .withRelated(["ORDISTATUSLOG_SUBFORM"]);
  })
  .select(["CUSTNAME", "CDES", "ORDNAME"])
  .get();
```

# API

## Methods

- (**constructor**)(< object >config) - Creates and returns a new Priority client instance. Valid config properties:

  - url - string - The company url to access Priority. Default: (none)
  - company - string - The company short name that should be accessed using the API. Default: (none)
  - username - string - The username used to access Priority Default: (none)
  - password - string - The password used to access Priority Default: (none)
  - langId - number - The language ID that you want to receive the response in. Only supported if the language is set up in Priority Default: (none)
  - file - string - The name of the file used that contains the data Default: 'tabula.ini'

- **screen**(< string >screenName) - (< PriorityClient >) - Sets the screen(collection) where the resources are fetched.

- **subform**(< string >subformName) - (< PriorityClient >) - Sets the related subform(sub-collection) where the resources are fetched.

- **findOne**(< object >identifier) - (< PriorityClient >) - Fetches only **ONE** entity from the related collection.

- **where**(< object >filters) - (< PriorityClient >) - Filters entities that match the filters in the collection

  > The filters are a key-value object where the value can be a `string || number` or an array with a logic operator as the first element and the value as the second:

  ```js
  const filters = { PRICE: 50 }; // PRICE+eq+50
  const logicalFilters = { PRICE: ["gt", 50] }; // PRICE+gt+50
  ```

- **withRelated**(< string[] >subforms) - (< PriorityClient >) - Includes subform data inside the related collection data

- **modifyRelated**(< string >subformName, modifierFunction) - (< PriorityClient >) - Modifies a subform that was included in the URL

- **select**(< string[] >fieldsToSelect) - (< PriorityClient >) - Selects the fields fetched

- **since**(< string >time) - (< PriorityClient >) - Fetches items created after a certain date

- **orderBy**(< string >field, < string >order) - (< PriorityClient >) - Sorts the entities fetched. The order can be: `"desc" | "asc"`

- **get**() - (Promise< any >) - Makes a `GET` request

- **post**() - (Promise< any >) - Makes a `POST` request

- **patch**() - (Promise< any >) - Makes a `PATCH` request

- **request**(< string >method, data) - (Promise< any >) - Makes a request with the provided method and data.

- **paginate**(< number >page, < number >size) - (Promise< any[] >) - Paginates the response from the API

- **paginateAction**(< number >page, < number >size, callback, limit) - (Promise< any[] >) - Paginates the response from the API and calls the callback passing the response as params. The `limit` is used to set the collective maximum number of entities that should fetched from the API: defaults to `Infinity`.

- **debug**(< number >page, < number >size) - (void) - Logs the param tree constructed by the api along with the config. Used for debugging
