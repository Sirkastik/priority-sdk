import { describe, it, expect } from 'vitest';

import QueryBuilder, { eq, lt, gt, desc } from '../src';

class ExtendedParametR extends URLSearchParams {
  add(name: string, value: string) {
    this.append(name, value);
    return this;
  }

  get value() {
    return '?' + this.toString();
  }
}

const paramR = () => new ExtendedParametR();

const concat = (...strs: any[]): string => {
  return strs.reduce((concated, str) => concated + str);
};

const toURL = (str: string) => new URL(str).toString();

const builder = new QueryBuilder(
  'https://www.eshbelsaas.com/ui/odata/Priority/tabmob.ini/usdemo',
  'apidemo',
  '123'
);

const BASE_URL =
  'https://www.eshbelsaas.com/ui/odata/Priority/tabmob.ini/usdemo';

const include = '$expand';

const filter = '$filter';

const since = '$since';

const orderBy = '$orderBy';

const select = '$select';

const s = '/';

const and = '+and+';

const screen = 'ORDERS';

const fetchAllUrl = toURL(concat(BASE_URL, s, screen));

const ORDNAME = 'SO17000001';

const findOneUrl = toURL(concat(fetchAllUrl, '(ORDNAME=', `'${ORDNAME}'`, ')'));

const subform = 'ORDERITEMS_SUBFORM';

const orderItemsSubformUrl = toURL(concat(findOneUrl, s, subform));

const includeOrderItemsUrl = toURL(
  concat(findOneUrl, paramR().add(include, subform).value)
);

const ORDSTATUSDES = 'Confirmed';

const orderStatusFilter = concat('ORDSTATUSDES', eq, `'${ORDSTATUSDES}'`);

const QPRICE = 50;

const priceStatusFilter = concat('QPRICE', lt, QPRICE);

const filterCollectionUrl1 = toURL(
  concat(fetchAllUrl, paramR().add(filter, orderStatusFilter).value)
);

const filterCollectionUrl2 = toURL(
  concat(
    fetchAllUrl,
    paramR().add(filter, concat(orderStatusFilter, and, priceStatusFilter))
      .value
  )
);

const sinceDate = '2020-06-01T01:15+02:00';

const sinceDateUrlWithSubform = toURL(
  concat(
    fetchAllUrl,
    paramR()
      .add(since, sinceDate)
      .add(include, subform).value
  )
);

const orderField = 'QPRICE';

const sortCollectionUrl = toURL(
  concat(
    fetchAllUrl,
    paramR().add(orderBy, concat(orderField, '+', desc)).value
  )
);

const fieldsToSelect = ['CUSTNAME', 'CDES', 'ORDNAME'];

const selectCollectionUrl = toURL(
  concat(findOneUrl, paramR().add(select, fieldsToSelect.join(',')).value)
);

const complexQueryUrl = toURL(
  concat(
    fetchAllUrl,
    paramR()
      .add(filter, "CUSTNAME+eq+'T000001'")
      .add(
        include,
        concat(
          'ORDERITEMS_SUBFORM(',
          [
            paramR().add(filter, 'PRICE+gt+3'),
            paramR().add(select, 'KLINE,PARTNAME,PDES,TQUANT,PRICE'),
            paramR().add(include, 'ORDISTATUSLOG_SUBFORM'),
          ].join(';'),
          '),SHIPTO2_SUBFORM,ORDERSTEXT_SUBFORM'
        )
      )
      .add(select, fieldsToSelect.join(',')).value
  )
);
// "https://www.eshbelsaas.com/ui/odata/Priority/tabmob.ini/usdemo/ORDERS?$filter=CUSTNAME+eq+'T000001'&$expand=ORDERITEMS_SUBFORM($filter=PRICE+gt+3;$select=KLINE,PARTNAME,PDES,TQUANT,PRICE;$expand=ORDISTATUSLOG_SUBFORM),SHIPTO2_SUBFORM,ORDERSTEXT_SUBFORM&$select=CUSTNAME,CDES,ORDNAME"

/** BEGINNING OF TESTS */

describe('builder creates url properly', () => {
  it('creates correct base url', () => {
    expect(builder.url).to.equal(BASE_URL);
  });

  it('creates correct collection url', () => {
    expect(builder.screen(screen).url).to.equal(fetchAllUrl);
  });

  it('creates correct single entity url', () => {
    expect(builder.screen(screen).findOne({ ORDNAME }).url).to.equal(
      findOneUrl
    );
  });

  it('creates correct sub-collection url', () => {
    expect(
      builder
        .screen(screen)
        .findOne({ ORDNAME })
        .subform(subform).url
    ).to.equal(orderItemsSubformUrl);
  });

  it('creates correct include sub-collection url', () => {
    expect(
      builder
        .screen(screen)
        .findOne({ ORDNAME })
        .withRelated([subform]).url
    ).to.equal(includeOrderItemsUrl);
  });

  it('creates correct filter query url', () => {
    expect(builder.screen(screen).where({ ORDSTATUSDES }).url).to.equal(
      filterCollectionUrl1
    );
  });

  it('creates correct multiple filter query url', () => {
    expect(
      builder.screen(screen).where({ ORDSTATUSDES, QPRICE: [lt, QPRICE] }).url
    ).to.equal(filterCollectionUrl2);
  });

  it('creates correct since date query url with sub-collection', () => {
    expect(
      builder
        .screen(screen)
        .since(sinceDate)
        .withRelated([subform]).url
    ).to.equal(sinceDateUrlWithSubform);
  });

  it('creates correct sort query url', () => {
    expect(builder.screen(screen).orderBy(orderField, desc).url).to.equal(
      sortCollectionUrl
    );
  });

  it('creates correct select query url', () => {
    expect(
      builder
        .screen(screen)
        .findOne({ ORDNAME })
        .select(fieldsToSelect).url
    ).to.equal(selectCollectionUrl);
  });

  it('creates correct combined complex query url', () => {
    expect(
      builder
        .screen(screen)
        .where({ CUSTNAME: 'T000001' })
        .withRelated([
          'ORDERITEMS_SUBFORM',
          'SHIPTO2_SUBFORM',
          'ORDERSTEXT_SUBFORM',
        ])
        .modifyRelated('ORDERITEMS_SUBFORM', qb =>
          qb
            .where({ PRICE: [gt, 3] })
            .select(['KLINE', 'PARTNAME', 'PDES', 'TQUANT', 'PRICE'])
            .withRelated(['ORDISTATUSLOG_SUBFORM'])
        )
        .select(['CUSTNAME', 'CDES', 'ORDNAME'])
        .url.split('?')[1]
    ).to.equal(complexQueryUrl.split('?')[1]);
  });
});

describe('it fetches from API', () => {
  it('paginates and collects', async () => {
    try {
      const page = 1;
      const size = 3;
      const limit = 3;
      const outputLength = await builder
        .screen(screen)
        .paginateAction(page, size, async _ => _, limit);
      expect(outputLength).to.equal(limit);
    } catch (message) {
      return console.error(message);
    }
  });

  it('executes [GET] method', async () => {
    try {
      const CUST = await builder
        .screen(screen)
        .findOne({ ORDNAME })
        .get<{ CDES: string }>();
      expect(CUST.CDES).to.equal('Wanda D. Holding');
    } catch (message) {
      return console.error(message);
    }
  });

  it('supports request with manual method', async () => {
    try {
      const { value } = await builder
        .screen(screen)
        .findOne({ ORDNAME })
        .subform(subform)
        .request<{ value: any[] }>('GET');
      expect(value[0].PARTNAME).to.equal('TR0003');
    } catch (message) {
      return console.error(message);
    }
  });
});
