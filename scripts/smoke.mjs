import { extractJsonLd, groupByRichResultType } from '../lib/extract.js';
import { validateItem } from '../lib/validate.js';

const html = `
<html><head><title>Test</title>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {"@type":"Organization","name":"Lotus","url":"https://example.com","logo":"https://example.com/logo.png"},
    {"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://example.com/"}]},
    {"@type":"LocalBusiness","name":"Lotus Pools","address":{"@type":"PostalAddress","streetAddress":"1 Main","addressLocality":"Town"},"telephone":"555","aggregateRating":{"@type":"AggregateRating","ratingValue":"4.8","reviewCount":"12"}}
  ]
}
</script></head><body></body></html>`;

const extracted = extractJsonLd(html);
const groups = groupByRichResultType(extracted.nodes);
console.log('groups:', [...groups.keys()].join(', '));
for (const [name, items] of groups) {
  for (const { type, node } of items) {
    const result = validateItem(name, node);
    console.log(`${name} / ${type}: valid=${result.valid}, critical=${result.critical.length}, warn=${result.nonCritical.length}`);
  }
}
