const QueryBuilder = require(".");

/**
 *
 * @param  {...string} strs strings to concatenate
 * @returns {string} concatenated string
 */
const concat = (...strs) => {
  return strs.reduce((concated, str) => concated + str);
};

const toURL = (str) => new URL(str).toString();

const builder = new QueryBuilder({
  url: "https://www.eshbelsaas.com/ui",
  company: "usdemo",
  username: "apidemo",
  password: "123",
  file: "tabmob.ini",
});

const BASE_URL =
  "https://www.eshbelsaas.com/ui/odata/Priority/tabmob.ini/usdemo";

const include = "$expand=";

const filter = "$filter=";

const since = "$since=";

const orderBy = "$orderBy=";

const select = "$select=";

const slash = "/";

const que = "?";

const amp = "&";

const eq = "+eq+";

const lt = "+lt+";

const gt = "+gt+";

const and = "+and+";

const screen = "ORDERS";

const fetchAllUrl = concat(BASE_URL, slash, screen);

const ORDNAME = "SO17000001";

const findOneUrl = concat(fetchAllUrl, "(ORDNAME=", ORDNAME, ")");

const subform = "ORDERITEMS_SUBFORM";

const orderItemsSubformUrl = concat(findOneUrl, slash, subform);

const includeOrderItemsUrl = concat(findOneUrl, que, include, subform);

const ORDSTATUSDES = "Confirmed";

const orderStatusFilter = concat("ORDSTATUSDES", eq, `'${ORDSTATUSDES}'`);

const QPRICE = 50;

const priceStatusFilter = concat("QPRICE", lt, QPRICE);

const filterCollectionUrl = concat(fetchAllUrl, que, filter, orderStatusFilter);

const filterCollectionUrl1 = toURL(filterCollectionUrl);

const filterCollectionUrl2 = toURL(
  concat(filterCollectionUrl, and, priceStatusFilter)
);

const sinceDate = "2020-06-01T01:15+02:00";

const sinceDateUrl = concat(fetchAllUrl, que, since, sinceDate);

const sinceDateUrlWithSubform = toURL(
  concat(sinceDateUrl, amp, include, subform)
);

const orderField = "QPRICE";

const order = "desc";

const sortCollectionUrl = toURL(
  concat(fetchAllUrl, que, orderBy, orderField, "+", order)
);

const fieldsToSelect = ["CUSTNAME", "CDES", "ORDNAME"];

const selectCollectionUrl = toURL(
  concat(findOneUrl, que, select, fieldsToSelect)
);

const complexQueryUrl = toURL(
  "https://www.eshbelsaas.com/ui/odata/Priority/tabmob.ini/usdemo/ORDERS?$filter=CUSTNAME+eq+'T000001'&$expand=ORDERITEMS_SUBFORM($filter=PRICE+gt+3;$select=CHARGEIV,KLINE,PARTNAME,PDES,TQUANT,PRICE;$expand=ORDISTATUSLOG_SUBFORM),SHIPTO2_SUBFORM,ORDERSTEXT_SUBFORM&$select=CUSTNAME,CDES,ORDNAME"
);

/** BEGINNING OF TESTS */

test("correct base url", () => {
  expect(builder.url).toBe(BASE_URL);
});

test("correct collection url", () => {
  expect(builder.screen(screen).url).toBe(fetchAllUrl);
});

test("correct single entity url", () => {
  expect(builder.screen(screen).findOne({ ORDNAME }).url).toBe(findOneUrl);
});

test("correct sub-collection url", () => {
  expect(builder.screen(screen).findOne({ ORDNAME }).subform(subform).url).toBe(
    orderItemsSubformUrl
  );
});

test("correct include sub-collection url", () => {
  expect(
    builder.screen(screen).findOne({ ORDNAME }).withRelated([subform]).url
  ).toBe(includeOrderItemsUrl);
});

test("correct filter query url", () => {
  expect(builder.screen(screen).where({ ORDSTATUSDES }).url).toBe(
    filterCollectionUrl1
  );
});

test("correct multiple filter query url", () => {
  expect(
    builder.screen(screen).where({ ORDSTATUSDES, QPRICE: [lt, QPRICE] }).url
  ).toBe(filterCollectionUrl2);
});

test("correct since date query url with sub-collection", () => {
  expect(
    builder.screen(screen).since(sinceDate).withRelated([subform]).url
  ).toBe(sinceDateUrlWithSubform);
});

test("correct sort query url", () => {
  expect(builder.screen(screen).orderBy(orderField, order).url).toBe(
    sortCollectionUrl
  );
});

test("correct select query url", () => {
  expect(
    builder.screen(screen).findOne({ ORDNAME }).select(fieldsToSelect).url
  ).toBe(selectCollectionUrl);
});

test("combined complex query url", () => {
  expect(
    builder
      .screen(screen)
      .where({ CUSTNAME: "T000001" })
      .withRelated([
        "ORDERITEMS_SUBFORM",
        "SHIPTO2_SUBFORM",
        "ORDERSTEXT_SUBFORM",
      ])
      .modifyRelated("ORDERITEMS_SUBFORM", (qb) =>
        qb
          .where({ PRICE: [gt, 3] })
          .select(["CHARGEIV", "KLINE", "PARTNAME", "PDES", "TQUANT", "PRICE"])
          .withRelated(["ORDISTATUSLOG_SUBFORM"])
      )
      .select(["CUSTNAME", "CDES", "ORDNAME"]).url
  ).toBe(complexQueryUrl);
});
