import * as cheerio from 'cheerio';

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeTypes(type) {
  return asArray(type).map(String);
}

const NESTED_KEYS = [
  '@graph',
  'mainEntity',
  'mainEntityOfPage',
  'about',
  'itemReviewed',
  'aggregateRating',
  'review',
  'publisher',
  'author',
  'brand',
  'offers',
  'breadcrumb',
  'isPartOf',
];

/**
 * Flatten @graph / nested nodes into a list of typed entities.
 * Nested AggregateRating / Review / Organization are kept as their own items
 * (closer to Google Rich Results Test grouping).
 */
export function flattenNodes(data, bag = [], seen = new WeakSet()) {
  for (const item of asArray(data)) {
    if (!item || typeof item !== 'object') continue;
    if (seen.has(item)) continue;
    seen.add(item);

    if (item['@type']) {
      bag.push(item);
    }

    for (const key of NESTED_KEYS) {
      if (item[key]) flattenNodes(item[key], bag, seen);
    }
  }
  return bag;
}

export function extractJsonLd(html) {
  const $ = cheerio.load(html);
  const blocks = [];
  const errors = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html()?.trim();
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      blocks.push({ raw, parsed });
    } catch (err) {
      errors.push({
        message: `Invalid JSON-LD: ${err.message}`,
        snippet: raw.slice(0, 200),
      });
    }
  });

  const nodes = [];
  for (const block of blocks) {
    flattenNodes(block.parsed, nodes);
  }

  return {
    blockCount: blocks.length,
    blocks,
    nodes,
    parseErrors: errors,
    title: $('title').first().text().trim() || null,
    canonical:
      $('link[rel="canonical"]').attr('href') ||
      $('meta[property="og:url"]').attr('content') ||
      null,
  };
}

export function groupByRichResultType(nodes) {
  const groups = new Map();

  for (const node of nodes) {
    const types = normalizeTypes(node['@type']);
    for (const type of types) {
      const key = classifyType(type);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ type, node });
    }
  }

  return groups;
}

function classifyType(type) {
  const t = type.replace(/^https?:\/\/schema\.org\//, '');

  if (t === 'BreadcrumbList') return 'Breadcrumbs';
  if (t === 'Organization' || t === 'Corporation' || t === 'NGO') return 'Organization';
  if (
    t === 'LocalBusiness' ||
    t.endsWith('Business') ||
    [
      'Restaurant',
      'Store',
      'HomeAndConstructionBusiness',
      'ProfessionalService',
      'MedicalBusiness',
      'LegalService',
      'FinancialService',
      'AutomotiveBusiness',
      'EntertainmentBusiness',
      'FoodEstablishment',
      'SportsActivityLocation',
      'LodgingBusiness',
      'TravelAgency',
      'RealEstateAgent',
      'RecyclingCenter',
      'SelfStorage',
      'ShoppingCenter',
      'SportsClub',
      'Library',
      'Museum',
      'Park',
      'Aquarium',
      'Zoo',
      'FireStation',
      'PoliceStation',
      'PostOffice',
      'Embassy',
      'Courthouse',
      'GovernmentOffice',
      'Cemetery',
      'Crematorium',
      'DryCleaningOrLaundry',
      'EmploymentAgency',
      'InternetCafe',
      'MovingCompany',
      'RadioStation',
      'TelevisionStation',
      'TouristInformationCenter',
      'Plumber',
      'Electrician',
      'HVACBusiness',
      'GeneralContractor',
      'HousePainter',
      'Locksmith',
      'MovingCompany',
      'RoofingContractor',
    ].includes(t)
  ) {
    return 'Local businesses';
  }
  if (t === 'Product' || t === 'IndividualProduct' || t === 'ProductModel') return 'Products';
  if (t === 'FAQPage' || t === 'QAPage') return 'FAQs';
  if (t === 'Article' || t === 'NewsArticle' || t === 'BlogPosting') return 'Articles';
  if (t === 'Review' || t === 'AggregateRating') return 'Review snippets';
  if (t === 'WebSite') return 'Sitelinks searchbox';
  if (t === 'HowTo') return 'How-tos';
  if (t === 'Event') return 'Events';
  if (t === 'Recipe') return 'Recipes';
  if (t === 'VideoObject') return 'Videos';
  if (t === 'JobPosting') return 'Job postings';
  if (t === 'Course') return 'Courses';
  if (t === 'SoftwareApplication' || t === 'MobileApplication') return 'Software apps';
  return null;
}
