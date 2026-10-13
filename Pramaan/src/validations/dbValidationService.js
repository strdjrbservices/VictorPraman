export const API_BASE_URL = (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL) || (
  typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.') ||
    window.location.hostname.startsWith('10.') ||
    window.location.hostname.startsWith('172.') ||
    window.location.port === '3000'
  )
    ? `http://${window.location.hostname || '127.0.0.1'}:8000`
    : (typeof window === 'undefined' ? 'http://127.0.0.1:8000' : 'https://appraisalreviewoffline-strdjrbservices.pythonanywhere.com')
);

let _cachedBundle = null;
let _fetchPromise = null;
const CACHE_KEY = 'pramaan_mongodb_revision_rules';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

// Synchronously initialize from sessionStorage if available for instant field rendering
if (typeof sessionStorage !== 'undefined') {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.timestamp && Date.now() - parsed.timestamp < CACHE_TTL_MS && parsed.bundle) {
        _cachedBundle = parsed.bundle;
      }
    }
  } catch (e) { }
}

/**
 * Normalizes field names for reliable keying and matching.
 */
export const normalizeFieldName = (name) => {
  if (!name) return '';
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
};

/**
 * Fetches all field revision rules from MongoDB Revision database via backend API.
 * Uses in-memory and sessionStorage caching for instant sub-millisecond retrieval.
 */
export const fetchDatabaseRules = async (forceRefresh = false) => {
  if (!forceRefresh && _cachedBundle && _cachedBundle.total_rules > 0) {
    return _cachedBundle;
  }

  // Check sessionStorage
  if (!forceRefresh && typeof sessionStorage !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.timestamp && Date.now() - parsed.timestamp < CACHE_TTL_MS && parsed.bundle) {
          _cachedBundle = parsed.bundle;
          return _cachedBundle;
        }
      }
    } catch (e) {
      // Ignore storage errors
    }
  }

  // Deduplicate inflight requests
  if (_fetchPromise && !forceRefresh) {
    return _fetchPromise;
  }

  _fetchPromise = (async () => {
    try {
      const url = `${API_BASE_URL}/api/validation/rules/${forceRefresh ? '?refresh=true' : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch validation rules: HTTP ${res.status}`);
      }
      const data = await res.json();
      _cachedBundle = {
        total_rules: data.total_rules || 0,
        total_sections: data.total_sections || 0,
        sections: data.sections || {},
        rules_by_field: data.rules_by_field || {},
        loadedAt: Date.now()
      };

      if (typeof sessionStorage !== 'undefined') {
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            bundle: _cachedBundle
          }));
        } catch (e) { }
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('dbValidationRulesLoaded', { detail: _cachedBundle }));
      }
      return _cachedBundle;
    } catch (err) {
      console.warn('Could not load MongoDB validation rules:', err.message);
      return _cachedBundle || { total_rules: 0, sections: {}, rules_by_field: {} };
    } finally {
      _fetchPromise = null;
    }
  })();

  return _fetchPromise;
};

// Auto-trigger prefetch in background when module is loaded
if (typeof window !== 'undefined') {
  setTimeout(() => {
    fetchDatabaseRules(false).catch(() => { });
  }, 500);
}

/**
 * Returns all MongoDB Revision rules mapped to a specific field.
 */
export const getRulesForField = (fieldName, sectionName = '') => {
  if (!_cachedBundle || !_cachedBundle.rules_by_field) {
    return [];
  }

  const cleanField = normalizeFieldName(fieldName);
  const cleanSection = normalizeFieldName(sectionName);
  const rulesMap = _cachedBundle.rules_by_field;

  // Direct lookup
  let matches = rulesMap[fieldName] || rulesMap[fieldName?.toLowerCase?.()] || [];

  if (!matches.length) {
    // Try normalized match
    for (const [key, rules] of Object.entries(rulesMap)) {
      if (normalizeFieldName(key) === cleanField) {
        matches = rules;
        break;
      }
    }
  }

  // Filter or fallback to section-specific rules if sectionName is provided
  if (!matches.length && cleanSection && _cachedBundle.sections) {
    for (const [secKey, secRules] of Object.entries(_cachedBundle.sections)) {
      if (normalizeFieldName(secKey).includes(cleanSection) || cleanSection.includes(normalizeFieldName(secKey))) {
        // Find rules in this section that mention the field
        const found = secRules.filter(r => {
          const rem = normalizeFieldName(r.remark);
          return rem.includes(cleanField) || (r.target_field_candidates || []).some(c => normalizeFieldName(c) === cleanField);
        });
        if (found.length) {
          matches = found;
          break;
        }
      }
    }
  }

  return matches;
};

/**
 * Returns the best MongoDB Revision remark for this field.
 * Used when copying revision language on the UI.
 */
export const getDbRevisionRemark = (fieldName, sectionName = '', currentValue = '') => {
  const rules = getRulesForField(fieldName, sectionName);
  if (!rules || !rules.length) {
    return null;
  }

  // Pick the most relevant rule (prefer one that mentions the field explicitly in quotes)
  const targetLower = String(fieldName || '').toLowerCase();
  const sorted = [...rules].sort((a, b) => {
    const aHasQuote = a.remark.toLowerCase().includes(`'${targetLower}'`) || a.remark.toLowerCase().includes(`"${targetLower}"`);
    const bHasQuote = b.remark.toLowerCase().includes(`'${targetLower}'`) || b.remark.toLowerCase().includes(`"${targetLower}"`);
    if (aHasQuote && !bHasQuote) return -1;
    if (!aHasQuote && bHasQuote) return 1;
    return 0;
  });

  const bestRule = sorted[0];
  let remark = bestRule.remark;

  // If the remark is a template or doesn't mention current value, we can present it cleanly
  return remark;
};

/**
 * Evaluates a field value dynamically using rules fetched from MongoDB Revision database.
 * Returns: { isError, isMatch, message, dbRule, source } or null if no rule applies.
 */
export const validateFieldWithDbRules = (lookupField, text, allData = {}, fieldPath = []) => {
  if (!_cachedBundle || _cachedBundle.total_rules === 0) {
    return null;
  }

  const sectionName = Array.isArray(fieldPath) && fieldPath.length > 1 ? fieldPath[0] : '';
  const rules = getRulesForField(lookupField, sectionName);

  if (!rules || rules.length === 0) {
    return null;
  }

  const strVal = (text !== undefined && text !== null) ? String(text).trim() : '';
  const isBlank = strVal === '';
  const cleanField = normalizeFieldName(lookupField);

  for (const rule of rules) {
    const remark = rule.remark;
    const remarkLower = remark.toLowerCase();

    // -------------------------------------------------------------
    // 1. Mandatory / Blank Checks
    // -------------------------------------------------------------
    const isMandatoryRule = (
      remarkLower.includes('must be noted') ||
      remarkLower.includes('must be stated') ||
      remarkLower.includes('must not be blank') ||
      remarkLower.includes('is blank') ||
      remarkLower.includes('please provide') ||
      remarkLower.includes('please state') ||
      remarkLower.includes('please mark') ||
      remarkLower.includes('is missing') ||
      remarkLower.includes('must be complete') ||
      remarkLower.includes('is required')
    );

    if (isMandatoryRule && isBlank) {
      return {
        isError: true,
        isMatch: false,
        message: `[DB Rule] ${remark}`,
        dbRule: remark,
        source: `MongoDB.Revision.${rule.section || 'General'}`
      };
    }

    // -------------------------------------------------------------
    // 2. Specific Field Pattern Validations from MongoDB Rules
    // -------------------------------------------------------------

    // FEMA Flood Zone & Special Flood Hazard Area (Rule from Revision.SITE)
    if (cleanField.includes('flood') || cleanField.includes('fema')) {
      const femaZone = String(allData.SITE?.['FEMA Flood Zone'] || allData['FEMA Flood Zone'] || '').trim().toUpperCase();
      const femaSpecial = String(allData.SITE?.['FEMA Special Flood Hazard Area'] || allData['FEMA Special Flood Hazard Area'] || '').trim().toLowerCase();
      const isSpecialZone = femaZone.startsWith('A') || femaZone.startsWith('V');

      if (isSpecialZone && femaSpecial === 'no') {
        if (cleanField.includes('special')) {
          return {
            isError: true,
            isMatch: false,
            message: `[DB Rule] Flood Zone is '${femaZone}', but Special Flood Hazard Area is marked 'No'; please reconcile.`,
            dbRule: remark,
            source: 'MongoDB.Revision.SITE'
          };
        }
      }
    }

    // Year Built (Rule from Revision.Improvements)
    if (cleanField === 'yearbuilt') {
      if (!isBlank && !/\b(18|19|20)\d{2}\b/.test(strVal)) {
        return {
          isError: true,
          isMatch: false,
          message: `[DB Rule] Year Built must be a valid 4-digit year. Current value: '${strVal}'.`,
          dbRule: remark,
          source: 'MongoDB.Revision.Improvements'
        };
      }
    }

    // PUD & HOA (Rule from Revision.Subject)
    if (cleanField === 'pud' || cleanField === 'hoa') {
      const isPud = String(allData['PUD'] || allData.Subject?.['PUD'] || '').toLowerCase() === 'yes';
      const hoaVal = parseFloat(String(allData['HOA $'] || allData.Subject?.['HOA $'] || '0').replace(/[^0-9.]/g, '')) || 0;
      if (isPud && hoaVal <= 0 && cleanField === 'hoa') {
        return {
          isError: true,
          isMatch: false,
          message: `[DB Rule] ${remark}`,
          dbRule: remark,
          source: 'MongoDB.Revision.Subject'
        };
      }
    }

    // Borrower comparison against order/HTML (Rule from Revision.Subject)
    if (cleanField === 'borrower') {
      const compBorrower = String(allData.comparisonData?.['Borrower (and Co-Borrower)'] || allData.comparisonData?.Borrower || '').trim();
      if (!isBlank && compBorrower && compBorrower !== 'N/A') {
        const bWords = strVal.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
        const cWords = compBorrower.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
        const hasOverlap = bWords.some(w => cWords.includes(w));
        if (!hasOverlap) {
          return {
            isError: true,
            isMatch: false,
            message: `[DB Rule] ${remark} (Report: '${strVal}' vs Order: '${compBorrower}')`,
            dbRule: remark,
            source: 'MongoDB.Revision.Subject'
          };
        }
      }
    }

    // Neighborhood One-Unit Housing Price Predominant Range (Rule from Revision.Neighborhood)
    if (cleanField.includes('housingprice') || cleanField.includes('oneunithousing')) {
      const pLow = parseFloat(String(allData.NEIGHBORHOOD?.['Lowest Sale Price'] || '').replace(/[^0-9.]/g, '')) || 0;
      const pHigh = parseFloat(String(allData.NEIGHBORHOOD?.['Highest Sale Price'] || '').replace(/[^0-9.]/g, '')) || 0;
      const pPred = parseFloat(String(allData.NEIGHBORHOOD?.['Median Sale Price'] || '').replace(/[^0-9.]/g, '')) || 0;

      if (pLow > 0 && pHigh > 0 && pLow > pHigh) {
        return {
          isError: true,
          isMatch: false,
          message: `[DB Rule] Neighborhood Low price ($${pLow}) exceeds High price ($${pHigh}). Values may be interchanged.`,
          dbRule: remark,
          source: 'MongoDB.Revision.Neighborhood'
        };
      }
      if (pLow > 0 && pHigh > 0 && pPred > 0 && (pPred < pLow || pPred > pHigh)) {
        return {
          isError: true,
          isMatch: false,
          message: `[DB Rule] Predominant price ($${pPred}) is outside Low ($${pLow}) to High ($${pHigh}) range.`,
          dbRule: remark,
          source: 'MongoDB.Revision.Neighborhood'
        };
      }
    }

    // Value is present and passed rule checks
    if (!isBlank) {
      return {
        isError: false,
        isMatch: true,
        message: `Verified per DB rule: "${remark.length > 70 ? remark.slice(0, 70) + '...' : remark}"`,
        dbRule: remark,
        source: `MongoDB.Revision.${rule.section || 'General'}`
      };
    }
  }

  return null;
};
