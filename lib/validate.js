function hasValue(v) {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
}

function get(obj, path) {
  return path.split('.').reduce((acc, key) => {
    if (acc == null) return undefined;
    return acc[key];
  }, obj);
}

function requireProps(node, props) {
  const missing = [];
  for (const prop of props) {
    if (!hasValue(get(node, prop))) missing.push(prop);
  }
  return missing;
}

function addressOk(address) {
  if (!address) return false;
  if (typeof address === 'string') return address.trim().length > 0;
  return (
    hasValue(address.streetAddress) ||
    hasValue(address.addressLocality) ||
    hasValue(address.postalCode)
  );
}

function validateBreadcrumbs(node) {
  const issues = [];
  const critical = [];
  const items = Array.isArray(node.itemListElement)
    ? node.itemListElement
    : node.itemListElement
      ? [node.itemListElement]
      : [];

  if (items.length < 1) {
    critical.push('Missing itemListElement');
  }

  items.forEach((item, i) => {
    if (!hasValue(item.name) && !hasValue(item.item?.name)) {
      issues.push(`ListItem[${i}] missing name`);
    }
    if (!hasValue(item.position) && item.position !== 0) {
      issues.push(`ListItem[${i}] missing position`);
    }
  });

  return {
    valid: critical.length === 0,
    critical,
    nonCritical: issues,
  };
}

function validateOrganization(node) {
  const missingRecommended = requireProps(node, ['name', 'url', 'logo']);
  const critical = requireProps(node, ['name']);
  return {
    valid: critical.length === 0,
    critical,
    nonCritical: missingRecommended
      .filter((p) => !critical.includes(p))
      .map((p) => `Recommended property missing: ${p}`),
  };
}

function validateLocalBusiness(node) {
  const critical = [];
  const nonCritical = [];

  if (!hasValue(node.name)) critical.push('Missing name');
  if (!addressOk(node.address)) critical.push('Missing or incomplete address');

  for (const prop of ['telephone', 'url', 'image', 'priceRange', 'openingHoursSpecification']) {
    if (!hasValue(node[prop])) {
      nonCritical.push(`Recommended property missing: ${prop}`);
    }
  }

  if (node.aggregateRating) {
    const ar = validateAggregateRating(node.aggregateRating);
    nonCritical.push(...ar.nonCritical);
    critical.push(...ar.critical);
  }

  return {
    valid: critical.length === 0,
    critical,
    nonCritical,
  };
}

function validateAggregateRating(node) {
  const critical = [];
  const nonCritical = [];
  if (!hasValue(node.ratingValue)) critical.push('AggregateRating missing ratingValue');
  if (!hasValue(node.reviewCount) && !hasValue(node.ratingCount)) {
    critical.push('AggregateRating missing reviewCount or ratingCount');
  }
  if (!hasValue(node.bestRating)) {
    nonCritical.push('Recommended property missing: bestRating');
  }
  return { valid: critical.length === 0, critical, nonCritical };
}

function validateReview(node) {
  const critical = [];
  const nonCritical = [];

  if (!hasValue(node.reviewRating) && !hasValue(node.author)) {
    critical.push('Review should include reviewRating and/or author');
  }
  if (!hasValue(node.itemReviewed) && !hasValue(node.author)) {
    nonCritical.push('Recommended: itemReviewed');
  }
  if (node.reviewRating && !hasValue(node.reviewRating.ratingValue)) {
    critical.push('reviewRating missing ratingValue');
  }

  return {
    valid: critical.length === 0,
    critical,
    nonCritical,
  };
}

function validateProduct(node) {
  const critical = [];
  const nonCritical = [];

  if (!hasValue(node.name)) critical.push('Missing name');
  if (!hasValue(node.image)) nonCritical.push('Recommended property missing: image');
  if (!hasValue(node.description)) nonCritical.push('Recommended property missing: description');

  const offers = node.offers
    ? Array.isArray(node.offers)
      ? node.offers
      : [node.offers]
    : [];

  if (!offers.length) {
    nonCritical.push('Recommended property missing: offers');
  } else {
    for (const [i, offer] of offers.entries()) {
      if (!hasValue(offer.price) && !hasValue(offer.lowPrice)) {
        nonCritical.push(`Offer[${i}] missing price`);
      }
      if (!hasValue(offer.priceCurrency)) {
        nonCritical.push(`Offer[${i}] missing priceCurrency`);
      }
      if (!hasValue(offer.availability)) {
        nonCritical.push(`Offer[${i}] missing availability`);
      }
    }
  }

  return { valid: critical.length === 0, critical, nonCritical };
}

function validateFaq(node) {
  const critical = [];
  const nonCritical = [];
  const entities = Array.isArray(node.mainEntity)
    ? node.mainEntity
    : node.mainEntity
      ? [node.mainEntity]
      : [];

  if (!entities.length) {
    critical.push('FAQPage missing mainEntity questions');
  }

  entities.forEach((q, i) => {
    if (!hasValue(q.name)) critical.push(`Question[${i}] missing name`);
    const accepted = q.acceptedAnswer;
    if (!accepted || (!hasValue(accepted.text) && !hasValue(accepted.name))) {
      critical.push(`Question[${i}] missing acceptedAnswer.text`);
    }
  });

  return { valid: critical.length === 0, critical, nonCritical };
}

function validateArticle(node) {
  const critical = requireProps(node, ['headline']);
  const nonCritical = [];
  for (const prop of ['image', 'datePublished', 'author', 'publisher']) {
    if (!hasValue(node[prop])) {
      nonCritical.push(`Recommended property missing: ${prop}`);
    }
  }
  return {
    valid: critical.length === 0,
    critical: critical.map((p) => `Missing ${p}`),
    nonCritical,
  };
}

function validateWebsite(node) {
  const critical = [];
  const nonCritical = [];
  if (!hasValue(node.url) && !hasValue(node.name)) {
    critical.push('WebSite should include name or url');
  }
  if (!hasValue(node.potentialAction)) {
    nonCritical.push('No SearchAction (sitelinks searchbox) detected');
  }
  return { valid: critical.length === 0, critical, nonCritical };
}

function validateGeneric(node) {
  return {
    valid: true,
    critical: [],
    nonCritical: hasValue(node.name) ? [] : ['No name property'],
  };
}

const VALIDATORS = {
  Breadcrumbs: validateBreadcrumbs,
  Organization: validateOrganization,
  'Local businesses': validateLocalBusiness,
  'Review snippets': (node) =>
    String(node['@type']).includes('AggregateRating')
      ? validateAggregateRating(node)
      : validateReview(node),
  Products: validateProduct,
  FAQs: validateFaq,
  Articles: validateArticle,
  'Sitelinks searchbox': validateWebsite,
};

export function validateItem(groupKey, node) {
  const fn = VALIDATORS[groupKey] || validateGeneric;
  const result = fn(node);
  return {
    ...result,
    valid: result.critical.length === 0,
  };
}
