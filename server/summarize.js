// Builds a readable summary for a story out of everything the publishers said
// about it.
//
// A story that several newsrooms ran gives us several descriptions of the same
// event. Previously the digest kept the longest one and discarded the rest,
// then cut it to a fixed character count — which is why so many summaries ended
// mid-sentence. Here they are pooled, split into sentences, deduplicated and
// re-assembled, so a summary is several complete sentences and never trails off.

/** Abbreviations whose full stop must not be read as the end of a sentence. */
const ABBREVIATIONS = [
  'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Rev', 'Hon', 'St', 'Jr', 'Sr',
  'Sen', 'Rep', 'Gov', 'Gen', 'Col', 'Lt', 'Sgt', 'Capt', 'Cmdr', 'Adm',
  'Inc', 'Ltd', 'Co', 'Corp', 'Est', 'Dept', 'Univ', 'Assn',
  'Jan', 'Feb', 'Mar', 'Apr', 'Jun', 'Jul', 'Aug', 'Sept', 'Sep', 'Oct', 'Nov', 'Dec',
  'vs', 'etc', 'approx', 'No', 'Vol', 'pp', 'al'
];

const DOT = ''; // stand-in for a full stop that is not a sentence end

/** Publisher furniture that carries no information about the story. */
/**
 * Publisher furniture that carries no information about the story.
 *
 * Every pattern here is anchored to the END of the text. Patterns that could
 * match mid-string were removed: `/sign up (for|to) .*$/` looks harmless until
 * a live-blog feed opens with "Sign up for Breaking News emails.", at which
 * point `.*$` swallows the entire summary. House-ad sentences wherever they
 * appear are handled by JUNK_SENTENCE instead.
 */
const BOILERPLATE = [
  /continue reading\.{0,3}\s*$/i,
  /the post .+ appeared first on .+$/i,
  /appeared first on .+$/i,
  /this article (originally )?appeared[^.]*$/i,
  /\[…\]\s*$/,
  /\.{3}\s*$/,
  /…\s*$/
];

function stripBoilerplate(text) {
  let out = String(text || '').trim();
  for (const re of BOILERPLATE) out = out.replace(re, '').trim();
  // A byline lead-in such as "By Jane Smith" or "Jane Smith reports".
  out = out.replace(/^by\s+[A-Z][\w'’-]+(?:\s+[A-Z][\w'’-]+){0,3}\s*[,–—-]?\s*/, '');
  // Datelines like "WASHINGTON (Reuters) -" or "LONDON —".
  out = out.replace(/^[A-Z][A-Z\s,.'-]{2,30}\s*(\([^)]{2,30}\))?\s*[-–—:]\s+/, '');
  // Collapse spaces but keep newlines: they mark the block boundaries that
  // toSentences relies on to separate a standfirst from the body.
  return out.replace(/[^\S\n]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

/** Split into sentences without breaking on abbreviations or decimals. */
export function toSentences(text) {
  if (!text) return [];
  // A block boundary is a hard sentence boundary, even without a full stop:
  // a standfirst is a complete thought that its publisher did not punctuate.
  if (String(text).includes('\n')) {
    return String(text)
      .split('\n')
      .flatMap((block) => toSentences(block.trim()))
      .filter(Boolean);
  }
  let masked = String(text);

  for (const abbr of ABBREVIATIONS) {
    masked = masked.replace(new RegExp(`\\b${abbr}\\.`, 'g'), `${abbr}${DOT}`);
  }
  // Single initials ("J. K. Rowling") and dotted acronyms ("U.S.", "a.m.").
  masked = masked.replace(/\b([A-Z])\.(?=\s?[A-Z])/g, `$1${DOT}`);
  masked = masked.replace(/\b([A-Za-z])\.(?=[A-Za-z]\.)/g, `$1${DOT}`);
  masked = masked.replace(/\b([A-Za-z])\.(?=[A-Za-z]\b)/g, `$1${DOT}`);
  // Decimals.
  masked = masked.replace(/(\d)\.(?=\d)/g, `$1${DOT}`);

  return masked
    .split(/(?<=[.!?])["'’”]?\s+(?=[A-Z“"'‘])/)
    .map((s) => s.split(DOT).join('.').trim())
    .flatMap(unglue)
    .filter(Boolean);
}

/**
 * Words that routinely precede a capitalised word without ending a sentence,
 * so a break after them would be wrong ("a depot in Runcorn on Monday").
 */
const FUNCTION_WORDS = new Set([
  'in', 'at', 'on', 'of', 'to', 'for', 'with', 'from', 'by', 'and', 'or', 'the', 'a', 'an',
  'into', 'near', 'across', 'against', 'about', 'over', 'under', 'via', 'per', 'that', 'than',
  'said', 'says', 'told', 'called', 'named', 'joins', 'visits', 'met', 'like', 'including'
]);

/**
 * Separate a standfirst that was glued to the body without punctuation.
 *
 * Most feeds mark that boundary with a paragraph tag, which toBlockText keeps.
 * A few emit one flat string -- "...trailers holding about 800 barrels The
 * famous tagline..." -- and no amount of punctuation-based splitting can help.
 * Break at a lowercase word followed by a capitalised one, but never after a
 * preposition or article, which is what makes "in Runcorn" safe.
 */
function unglue(sentence) {
  if (sentence.length < 140) return [sentence];
  if (/[.!?]\s/.test(sentence)) return [sentence];

  const re = /\b([a-z]{4,})\s+(?=[A-Z][a-z]{2,})/g;
  let match;
  while ((match = re.exec(sentence))) {
    if (FUNCTION_WORDS.has(match[1])) continue;
    const cut = match.index + match[0].length;
    const left = sentence.slice(0, cut).trim();
    const right = sentence.slice(cut).trim();
    if (left.length >= 45 && right.length >= 45) return [left, right];
  }
  return [sentence];
}

const STOP = new Set([
  'the', 'a', 'an', 'of', 'in', 'on', 'to', 'for', 'and', 'as', 'at', 'is', 'are', 'was',
  'were', 'with', 'says', 'say', 'said', 'after', 'over', 'from', 'by', 'its', 'his', 'her',
  'their', 'this', 'that', 'has', 'have', 'had', 'been', 'will', 'be', 'it', 'not', 'but',
  'who', 'how', 'why', 'what', 'into', 'amid', 'about', 'more', 'than', 'they', 'he', 'she'
]);

function tokens(text) {
  return new Set(
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(/\s+/)
      // Numbers are kept whatever their length: an age, a score or a death
      // toll is often the very token that marks two sentences as one fact.
      .filter((w) => (w.length > 2 || /^\d+$/.test(w)) && !STOP.has(w))
  );
}

function overlap(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / Math.min(a.size, b.size);
}

function isComplete(sentence) {
  return /[.!?]["'’”]?$/.test(sentence.trim());
}

/**
 * How much this sentence is worth including.
 *
 * Earlier sentences carry the news; later ones drift into background. Concrete
 * detail — numbers, dates, quoted speech, proper nouns — is what makes a
 * summary worth reading rather than a restatement of the headline.
 */
function scoreSentence(sentence, index) {
  const words = sentence.split(/\s+/).length;
  let score = 100 - index * 12;

  if (words < 6) score -= 60;
  if (words > 45) score -= 25;
  if (words >= 10 && words <= 34) score += 15;

  if (/\d/.test(sentence)) score += 12; // figures, dates, ages, counts
  if (/[""“”]/.test(sentence)) score += 6; // direct speech
  if (/\b(said|told|announced|confirmed|warned|accused|ruled|voted|agreed)\b/i.test(sentence)) {
    score += 10; // attributed action
  }
  if (/\b(percent|per cent|%|million|billion|trillion)\b/i.test(sentence)) score += 8;
  if (!isComplete(sentence)) score -= 45;
  if (/^(and|but|or|so|also|meanwhile|however)\b/i.test(sentence)) score -= 15;

  return score;
}

/**
 * How informative one outlet's whole description is.
 *
 * Used to pick a "spine" — the single account the summary is built around.
 */
function scoreSource(sentences) {
  if (!sentences.length) return -Infinity;
  const chars = sentences.reduce((n, x) => n + x.length, 0);
  const complete = sentences.filter(isComplete).length;
  const detail = sentences.filter((x) => /\d/.test(x)).length;
  return chars * 0.4 + complete * 40 + detail * 25 + Math.min(sentences.length, 4) * 20;
}

/**
 * Sentences that are house advertising rather than news. These turn up in the
 * middle of live-blog feeds, not only at the end, so the trailing-boilerplate
 * strip does not catch them.
 */
const JUNK_SENTENCE = /^(sign up|subscribe|follow us|follow our|get the|download the|support (us|the)|read more|listen to|watch |advertisement|click here|this (live )?blog|our live coverage|updates? (will )?continue|that concludes)\b/i;

/** Broadcast trailers describe the coverage, not the event. */
const PROMO = /\b(reports? on|speaks (to|with)|joins (us|the)|breaks down|weighs in|takes a look|tells .+ about|watch |video:|listen:)/i;

/**
 * Compose a summary from every description available for one story.
 *
 * Several outlets covering one event all lead with the same fact, so naively
 * pooling their sentences produced four different ways of saying "Gloria
 * Steinem died at 92". Instead one account is chosen as the spine and read in
 * its own order; other outlets contribute only sentences that add something
 * genuinely new, judged on a much stricter novelty threshold.
 *
 * @param {object}   story
 * @param {string}   story.title       the headline, so the summary does not repeat it
 * @param {string[]} story.summaries   one description per outlet that ran the story
 * @param {number}   [maxChars]        soft budget; a sentence is never cut in half
 * @param {number}   [maxSentences]
 * @returns {string} complete sentences, or '' when nothing usable was supplied
 */
export function composeSummary({ title = '', summaries = [] }, maxChars = 420, maxSentences = 4) {
  const titleTokens = tokens(title);

  const usable = (sentence) =>
    // 25, not 30: 'Prices rose again in August.' is a perfectly good sentence.
    sentence.length >= 25 &&
    !JUNK_SENTENCE.test(sentence) &&
    !PROMO.test(sentence) &&
    overlap(tokens(sentence), titleTokens) < 0.75;

  // Group sentences by the outlet they came from, keeping their reading order.
  const sources = [];
  for (const raw of summaries) {
    const cleaned = stripBoilerplate(raw);
    if (!cleaned) continue;
    const sentences = toSentences(cleaned).filter(usable);
    if (sentences.length) sources.push(sentences);
  }
  if (!sources.length) return '';

  /*
   * A standfirst is written as a teaser and left unpunctuated, and the body
   * that follows usually says the same thing more precisely. Keeping both
   * produced the run-on "...in demand for chips Nvidia will buy...", so drop
   * the fragment whenever a later complete sentence covers it.
   */
  for (const source of sources) {
    for (let i = source.length - 1; i >= 0; i--) {
      if (isComplete(source[i])) continue;
      const t = tokens(source[i]);
      const restated = source
        .slice(i + 1)
        .some((later) => isComplete(later) && overlap(t, tokens(later)) >= 0.45);
      if (restated) source.splice(i, 1);
    }
  }

  sources.sort((a, b) => scoreSource(b) - scoreSource(a));

  const chosen = [];
  const chosenTokens = [];
  let length = 0;

  /*
   * A standfirst is unpunctuated but complete in meaning, and it always leads.
   * An unpunctuated sentence anywhere else is a feed truncation -- half a
   * thought. Appending a full stop to that produced nonsense like "According
   * to Ynet News, the people he allegedly approached.", so only the first
   * sentence of a source is allowed to be incomplete.
   */
  const tryAdd = (sentence, noveltyLimit, position = 0) => {
    if (chosen.length >= maxSentences) return false;
    if (!isComplete(sentence) && position > 0) return false;
    if (length && length + sentence.length + 1 > maxChars) return false;
    const t = tokens(sentence);
    if (chosenTokens.some((c) => overlap(c, t) >= noveltyLimit)) return false;
    chosen.push(sentence);
    chosenTokens.push(t);
    length += sentence.length + 1;
    return true;
  };

  // The spine: the fullest single account, in the order its author wrote it.
  sources[0].forEach((sentence, i) => tryAdd(sentence, 0.6, i));

  // Other outlets top up only with materially different information.
  for (const source of sources.slice(1)) {
    if (chosen.length >= maxSentences) break;
    // A quarter of shared content words is enough to call it a restatement:
    // outlets covering one event reuse the same names, verbs and figures.
    source.forEach((sentence, i) => tryAdd(sentence, 0.25, i));
  }

  if (!chosen.length) return '';

  /* Terminate each sentence, so an unpunctuated one cannot run into the next. */
  const punctuate = (sentence) => {
    if (isComplete(sentence)) return sentence;
    const trimmed = sentence
      .replace(/[\s,;:\u2013\u2014-]+$/, '')
      .replace(/\s+\b(and|or|but|with|to|of|for|in|on|at|by|from|that|which|as|the|an?)$/i, '');
    return trimmed ? trimmed + '.' : '';
  };

  let text = chosen.map(punctuate).filter(Boolean).join(' ').replace(/[^\S\n]+/g, ' ').trim();

  // Never hand back something that trails off. If the final sentence is
  // incomplete, drop it rather than closing it with an ellipsis.
  if (!isComplete(text) && chosen.length > 1) {
    chosen.pop();
    text = chosen.join(' ').replace(/\s+/g, ' ').trim();
  }
  if (!isComplete(text)) {
    text = text.replace(/[\s,;:\u2013\u2014-]+$/, '');
    // Also drop a dangling connective, so a clipped sentence does not end
    // on "and." or "of." once the full stop is added.
    text = text.replace(/\s+\b(and|or|but|with|to|of|for|in|on|at|by|from|that|which|as|the|an?)$/i, '');
    if (text) text += '.';
  }

  return text;
}
