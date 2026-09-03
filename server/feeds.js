// Topic catalogue. Every topic pulls from many independent outlets so a single
// dead feed never empties a section, and so each day has real depth.
//
// Feeds are verified with `npm run check`.

export const TOPICS = [
  {
    id: 'top',
    label: 'Top Stories',
    blurb: 'The headlines everyone is talking about right now.',
    accent: '#6366f1',
    feeds: [
      'https://feeds.bbci.co.uk/news/rss.xml',
      'https://www.theguardian.com/world/rss',
      'https://feeds.npr.org/1001/rss.xml',
      'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
      'https://www.axios.com/feeds/feed.rss',
      'https://www.aljazeera.com/xml/rss/all.xml',
      'https://www.independent.co.uk/news/world/rss',
      'https://feeds.skynews.com/feeds/rss/home.xml',
      'https://abcnews.go.com/abcnews/topstories',
      'https://feeds.nbcnews.com/nbcnews/public/news',
      'https://www.pbs.org/newshour/feeds/rss/headlines',
      'https://www.cbc.ca/webfeed/rss/rss-topstories',
      'https://time.com/feed/',
      'https://www.france24.com/en/rss'
    ]
  },

  {
    id: 'israel',
    label: 'Israel & Palestine',
    blurb: 'Israeli and Palestinian outlets alongside international coverage.',
    accent: '#0284c7',
    // Applied only to the general-news feeds, so a broad wire cannot drift
    // unrelated world stories into this desk.
    relevance:
      /\b(israel|israeli|palestin|gaza|west bank|jerusalem|tel aviv|netanyahu|idf|hamas|hezbollah|knesset|ramallah|rafah|khan younis|jenin|nablus|hebron|golan|zionis|antisemit|two-state|settler|unrwa|al-aqsa|haredi|likud|shin bet|mossad)\b/i,
    feeds: [
      // Israeli press
      'https://www.timesofisrael.com/feed/',
      'https://www.haaretz.com/cmlink/1.4605102',
      'https://www.jpost.com/rss/rssfeedsisraelnews.aspx',
      'https://www.jpost.com/rss/rssfeedsfrontpage.aspx',
      'https://www.jpost.com/rss/rssfeedsmiddleeastnews.aspx',
      'https://www.israelhayom.com/feed/',
      'https://www.jns.org/feed/',
      'https://www.jewishpress.com/feed/',
      'https://972mag.com/feed/',
      // Palestinian and pro-Palestinian press
      'https://electronicintifada.net/rss.xml',
      'https://imemc.org/feed/',
      'https://mondoweiss.net/feed/',
      'https://www.middleeastmonitor.com/feed/',
      // Regional and international coverage
      'https://www.aljazeera.com/xml/rss/all.xml',
      'https://www.middleeasteye.net/rss',
      'https://www.aa.com.tr/en/rss/default?cat=middle-east',
      'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml',
      'https://rss.nytimes.com/services/xml/rss/nyt/MiddleEast.xml',
      'https://www.theguardian.com/world/middleeast/rss',
      'https://www.al-monitor.com/rss'
    ]
  },

  {
    id: 'mideast',
    label: 'Middle East',
    blurb: 'The wider region — the Gulf, Iran, Turkey, Syria, Egypt and beyond.',
    accent: '#b45309',
    relevance:
      /\b(israel|palestin|gaza|iran|iranian|tehran|saudi|riyadh|uae|emirat|dubai|abu dhabi|qatar|doha|kuwait|bahrain|oman|yemen|houthi|syria|damascus|lebanon|beirut|hezbollah|iraq|baghdad|kurd|jordan|amman|egypt|cairo|turkey|turkish|ankara|istanbul|middle east|persian gulf|red sea|arab|opec)\b/i,
    feeds: [
      'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml',
      'https://www.theguardian.com/world/middleeast/rss',
      'https://rss.nytimes.com/services/xml/rss/nyt/MiddleEast.xml',
      'https://www.aljazeera.com/xml/rss/all.xml',
      'https://www.al-monitor.com/rss',
      'https://www.middleeasteye.net/rss',
      'https://www.newarab.com/rss',
      'https://www.aa.com.tr/en/rss/default?cat=middle-east',
      'https://www.middleeastmonitor.com/feed/',
      'https://www.timesofisrael.com/feed/',
      'https://www.france24.com/en/rss'
    ]
  },

  {
    id: 'world',
    label: 'World',
    blurb: 'Global affairs, conflict, diplomacy and development.',
    accent: '#0ea5e9',
    feeds: [
      'https://feeds.bbci.co.uk/news/world/rss.xml',
      'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
      'https://www.theguardian.com/world/rss',
      'https://feeds.npr.org/1004/rss.xml',
      'https://www.aljazeera.com/xml/rss/all.xml',
      'https://www.independent.co.uk/news/world/rss',
      'https://feeds.skynews.com/feeds/rss/world.xml',
      'https://feeds.washingtonpost.com/rss/world',
      'https://www.france24.com/en/rss',
      'https://rss.dw.com/rdf/rss-en-all',
      'https://www.euronews.com/rss',
      'https://abcnews.go.com/abcnews/internationalheadlines',
      'https://www.cbc.ca/webfeed/rss/rss-world',
      'https://www.aa.com.tr/en/rss/default?cat=world',
      'https://www.economist.com/latest/rss.xml'
    ]
  },

  {
    id: 'broadcast',
    label: 'Broadcast',
    blurb: 'What the television and radio newsrooms are leading with.',
    accent: '#e11d48',
    feeds: [
      'https://feeds.bbci.co.uk/news/rss.xml',
      'https://feeds.skynews.com/feeds/rss/home.xml',
      'https://feeds.skynews.com/feeds/rss/world.xml',
      'https://www.aljazeera.com/xml/rss/all.xml',
      'https://www.france24.com/en/rss',
      'https://rss.dw.com/rdf/rss-en-all',
      'https://www.euronews.com/rss',
      'https://abcnews.go.com/abcnews/topstories',
      'https://feeds.nbcnews.com/nbcnews/public/news',
      'https://www.cbsnews.com/latest/rss/world',
      'https://www.cbsnews.com/latest/rss/us',
      'https://www.pbs.org/newshour/feeds/rss/headlines',
      'https://www.pbs.org/newshour/feeds/rss/world',
      'https://moxie.foxnews.com/google-publisher/latest.xml',
      'https://www.cbc.ca/webfeed/rss/rss-topstories',
      'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml',
      'https://www.rte.ie/feeds/rss/?index=/news/',
      'https://feeds.npr.org/1001/rss.xml'
    ]
  },

  {
    id: 'politics',
    label: 'Politics',
    blurb: 'Elections, legislation, and the people running things.',
    accent: '#ef4444',
    feeds: [
      'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml',
      'https://feeds.npr.org/1014/rss.xml',
      'https://www.theguardian.com/politics/rss',
      'https://thehill.com/news/feed/',
      'https://rss.politico.com/politics-news.xml',
      'https://feeds.washingtonpost.com/rss/politics',
      'https://www.vox.com/rss/index.xml',
      'https://slate.com/feeds/all.rss',
      'https://www.thedailybeast.com/arc/outboundfeeds/rss/'
    ]
  },

  {
    id: 'us',
    label: 'United States',
    blurb: 'National news from across the fifty states.',
    accent: '#3b82f6',
    feeds: [
      'https://rss.nytimes.com/services/xml/rss/nyt/US.xml',
      'https://www.theguardian.com/us-news/rss',
      'https://feeds.npr.org/1003/rss.xml',
      'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml',
      'https://feeds.washingtonpost.com/rss/national',
      'https://www.cbsnews.com/latest/rss/us',
      'https://nypost.com/feed/',
      'https://www.latimes.com/world-nation/rss2.0.xml',
      'https://www.newsweek.com/rss'
    ]
  },

  {
    id: 'uk',
    label: 'United Kingdom',
    blurb: 'Westminster, the nations, and life across Britain and Ireland.',
    accent: '#7c3aed',
    feeds: [
      'https://feeds.bbci.co.uk/news/uk/rss.xml',
      'https://www.theguardian.com/uk-news/rss',
      'https://www.independent.co.uk/news/uk/rss',
      'https://feeds.skynews.com/feeds/rss/uk.xml',
      'https://www.telegraph.co.uk/rss.xml',
      'https://www.mirror.co.uk/news/?service=rss',
      'https://www.irishtimes.com/arc/outboundfeeds/rss/',
      'https://www.rte.ie/feeds/rss/?index=/news/'
    ]
  },

  {
    id: 'business',
    label: 'Business',
    blurb: 'Companies, deals, labour and the wider economy.',
    accent: '#f59e0b',
    feeds: [
      'https://feeds.bbci.co.uk/news/business/rss.xml',
      'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml',
      'https://www.theguardian.com/business/rss',
      'https://feeds.npr.org/1006/rss.xml',
      'https://www.cnbc.com/id/10001147/device/rss/rss.html',
      'https://feeds.washingtonpost.com/rss/business',
      'https://www.ft.com/rss/home',
      'https://www.economist.com/latest/rss.xml'
    ]
  },

  {
    id: 'markets',
    label: 'Markets',
    blurb: 'Equities, rates, commodities and macro moves.',
    accent: '#10b981',
    feeds: [
      'https://feeds.content.dowjones.io/public/rss/mw_topstories',
      'https://www.cnbc.com/id/100003114/device/rss/rss.html',
      'https://finance.yahoo.com/news/rssindex',
      'https://www.cnbc.com/id/20910258/device/rss/rss.html',
      'https://www.cnbc.com/id/10000108/device/rss/rss.html',
      'https://www.ft.com/rss/home'
    ]
  },

  {
    id: 'tech',
    label: 'Technology',
    blurb: 'Hardware, software, platforms and the industry behind them.',
    accent: '#8b5cf6',
    feeds: [
      'https://feeds.arstechnica.com/arstechnica/index',
      'https://www.theverge.com/rss/index.xml',
      'https://techcrunch.com/feed/',
      'https://www.wired.com/feed/rss',
      'https://www.engadget.com/rss.xml',
      'https://feeds.bbci.co.uk/news/technology/rss.xml',
      'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml',
      'https://www.theguardian.com/technology/rss'
    ]
  },

  {
    id: 'ai',
    label: 'AI',
    blurb: 'Models, research, regulation and the AI economy.',
    accent: '#a855f7',
    feeds: [
      'https://www.technologyreview.com/feed/',
      'https://venturebeat.com/category/ai/feed/',
      'https://techcrunch.com/category/artificial-intelligence/feed/',
      'https://www.theverge.com/rss/index.xml',
      'https://arstechnica.com/ai/feed/',
      'https://www.artificialintelligence-news.com/feed/'
    ]
  },

  {
    id: 'science',
    label: 'Science',
    blurb: 'Discoveries, research and the people making them.',
    accent: '#06b6d4',
    feeds: [
      'https://phys.org/rss-feed/',
      'https://www.sciencedaily.com/rss/all.xml',
      'https://www.nature.com/nature.rss',
      'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml',
      'https://feeds.npr.org/1007/rss.xml',
      'https://www.theguardian.com/science/rss',
      'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml'
    ]
  },

  {
    id: 'space',
    label: 'Space',
    blurb: 'Launches, missions, astronomy and the space industry.',
    accent: '#4f46e5',
    feeds: [
      'https://www.space.com/feeds/all',
      'https://spacenews.com/feed/',
      'https://rss.nytimes.com/services/xml/rss/nyt/Space.xml',
      'https://phys.org/rss-feed/space-news/'
    ]
  },

  {
    id: 'health',
    label: 'Health',
    blurb: 'Medicine, public health, and how it reaches patients.',
    accent: '#ec4899',
    feeds: [
      'https://feeds.bbci.co.uk/news/health/rss.xml',
      'https://www.statnews.com/feed/',
      'https://rss.nytimes.com/services/xml/rss/nyt/Health.xml',
      'https://www.theguardian.com/society/health/rss',
      'https://feeds.npr.org/1128/rss.xml'
    ]
  },

  {
    id: 'climate',
    label: 'Climate',
    blurb: 'Emissions, energy transition, weather and ecosystems.',
    accent: '#22c55e',
    feeds: [
      'https://www.theguardian.com/environment/rss',
      'https://insideclimatenews.org/feed/',
      'https://grist.org/feed/',
      'https://rss.nytimes.com/services/xml/rss/nyt/Climate.xml',
      'https://www.carbonbrief.org/feed'
    ]
  },

  {
    id: 'energy',
    label: 'Energy',
    blurb: 'Oil, gas, renewables, grids and utilities.',
    accent: '#eab308',
    feeds: [
      'https://oilprice.com/rss/main',
      'https://rss.nytimes.com/services/xml/rss/nyt/EnergyEnvironment.xml',
      'https://www.theguardian.com/environment/energy/rss',
      'https://electrek.co/feed/'
    ]
  },

  {
    id: 'sports',
    label: 'Sports',
    blurb: 'Results, transfers and everything around the game.',
    accent: '#f97316',
    feeds: [
      'https://feeds.bbci.co.uk/sport/rss.xml',
      'https://sports.yahoo.com/rss/',
      'https://www.theguardian.com/sport/rss',
      'https://www.cbssports.com/rss/headlines/',
      'https://www.independent.co.uk/sport/rss'
    ]
  },

  {
    id: 'entertainment',
    label: 'Entertainment',
    blurb: 'Film, television, music and the business of both.',
    accent: '#d946ef',
    feeds: [
      'https://variety.com/feed/',
      'https://www.hollywoodreporter.com/feed/',
      'https://deadline.com/feed/',
      'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml',
      'https://pitchfork.com/rss/news/'
    ]
  },

  {
    id: 'culture',
    label: 'Arts & Culture',
    blurb: 'Books, art, design, ideas and criticism.',
    accent: '#f43f5e',
    feeds: [
      'https://www.theguardian.com/culture/rss',
      'https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml',
      'https://feeds.npr.org/1008/rss.xml',
      'https://www.theguardian.com/books/rss',
      'https://www.newyorker.com/feed/everything',
      'https://www.theatlantic.com/feed/all/'
    ]
  },

  {
    id: 'gaming',
    label: 'Gaming',
    blurb: 'Releases, studios, hardware and the players.',
    accent: '#14b8a6',
    feeds: [
      'https://www.polygon.com/rss/index.xml',
      'https://www.eurogamer.net/feed',
      'https://feeds.ign.com/ign/games-all',
      'https://kotaku.com/rss'
    ]
  },

  {
    id: 'cyber',
    label: 'Cybersecurity',
    blurb: 'Breaches, vulnerabilities, and defence.',
    accent: '#64748b',
    feeds: [
      'https://krebsonsecurity.com/feed/',
      'https://www.bleepingcomputer.com/feed/',
      'https://feeds.feedburner.com/TheHackersNews',
      'https://www.darkreading.com/rss.xml'
    ]
  },

  {
    id: 'crypto',
    label: 'Crypto',
    blurb: 'Digital assets, protocols and regulation.',
    accent: '#f59e0b',
    feeds: [
      'https://www.coindesk.com/arc/outboundfeeds/rss/',
      'https://cointelegraph.com/rss',
      'https://decrypt.co/feed'
    ]
  },

  {
    id: 'defense',
    label: 'Defence',
    blurb: 'Militaries, procurement and security policy.',
    accent: '#78716c',
    feeds: [
      'https://breakingdefense.com/feed/',
      'https://warontherocks.com/feed/',
      'https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml'
    ]
  },

  {
    id: 'legal',
    label: 'Law & Justice',
    blurb: 'Courts, rulings, crime and civil rights.',
    accent: '#0f766e',
    feeds: [
      'https://www.theguardian.com/law/rss',
      'https://www.scotusblog.com/feed/',
      'https://www.theguardian.com/uk/law/rss',
      'https://www.courthousenews.com/feed/',
      'https://reason.com/feed/'
    ]
  },

  {
    id: 'media',
    label: 'Media',
    blurb: 'Journalism, streaming, platforms and attention.',
    accent: '#8b5cf6',
    feeds: [
      'https://www.theguardian.com/media/rss',
      'https://www.niemanlab.org/feed/',
      'https://www.poynter.org/feed/'
    ]
  },

  {
    id: 'education',
    label: 'Education',
    blurb: 'Schools, universities, policy and students.',
    accent: '#2563eb',
    feeds: [
      'https://www.theguardian.com/education/rss',
      'https://feeds.npr.org/1013/rss.xml',
      'https://rss.nytimes.com/services/xml/rss/nyt/Education.xml',
      'https://www.insidehighered.com/rss.xml',
      'https://hechingerreport.org/feed/',
      'https://www.edsurge.com/articles_rss'
    ]
  },

  {
    id: 'travel',
    label: 'Travel',
    blurb: 'Destinations, aviation and how people move.',
    accent: '#0891b2',
    feeds: [
      'https://www.theguardian.com/travel/rss',
      'https://rss.nytimes.com/services/xml/rss/nyt/Travel.xml',
      'https://skift.com/feed/'
    ]
  },

  {
    id: 'food',
    label: 'Food',
    blurb: 'Restaurants, recipes, agriculture and appetite.',
    accent: '#e11d48',
    feeds: [
      'https://www.theguardian.com/food/rss',
      'https://www.eater.com/rss/index.xml',
      'https://www.bonappetit.com/feed/rss',
      'https://rss.nytimes.com/services/xml/rss/nyt/DiningandWine.xml'
    ]
  },

  {
    id: 'style',
    label: 'Style',
    blurb: 'Fashion, design and living well.',
    accent: '#be185d',
    feeds: [
      'https://www.theguardian.com/fashion/rss',
      'https://rss.nytimes.com/services/xml/rss/nyt/FashionandStyle.xml',
      'https://www.theguardian.com/lifeandstyle/rss'
    ]
  },

  {
    id: 'auto',
    label: 'Autos',
    blurb: 'Cars, EVs, mobility and the industry.',
    accent: '#1d4ed8',
    feeds: [
      'https://electrek.co/feed/',
      'https://rss.nytimes.com/services/xml/rss/nyt/Automobiles.xml',
      'https://www.caranddriver.com/rss/all.xml/'
    ]
  },

  {
    id: 'realestate',
    label: 'Real Estate',
    blurb: 'Housing, property markets and cities.',
    accent: '#65a30d',
    feeds: [
      'https://rss.nytimes.com/services/xml/rss/nyt/RealEstate.xml',
      'https://www.theguardian.com/money/property/rss',
      'https://www.housingwire.com/feed/',
      'https://www.bisnow.com/rss'
    ]
  },

  {
    id: 'africa',
    label: 'Africa',
    blurb: 'News from across the continent.',
    accent: '#ca8a04',
    feeds: [
      'https://feeds.bbci.co.uk/news/world/africa/rss.xml',
      'https://www.theguardian.com/world/africa/rss',
      'https://www.aljazeera.com/xml/rss/all.xml',
      'https://www.aa.com.tr/en/rss/default?cat=africa',
      'https://www.france24.com/en/afrique/rss'
    ]
  },

  {
    id: 'asia',
    label: 'Asia',
    blurb: 'From the Pacific rim to South Asia.',
    accent: '#dc2626',
    feeds: [
      'https://feeds.bbci.co.uk/news/world/asia/rss.xml',
      'https://www.theguardian.com/world/asia-pacific/rss',
      'https://rss.nytimes.com/services/xml/rss/nyt/AsiaPacific.xml',
      'https://www.scmp.com/rss/91/feed',
      'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml',
      'https://www.japantimes.co.jp/feed/',
      'https://www.straitstimes.com/news/world/rss.xml',
      'https://www.thehindu.com/news/international/feeder/default.rss',
      'https://indianexpress.com/feed/'
    ]
  },

  {
    id: 'europe',
    label: 'Europe',
    blurb: 'The EU, the UK and the wider continent.',
    accent: '#1e40af',
    feeds: [
      'https://feeds.bbci.co.uk/news/world/europe/rss.xml',
      'https://www.theguardian.com/world/europe-news/rss',
      'https://rss.nytimes.com/services/xml/rss/nyt/Europe.xml',
      'https://www.euronews.com/rss',
      'https://rss.dw.com/rdf/rss-en-all',
      'https://www.lemonde.fr/en/rss/une.xml',
      'https://www.spiegel.de/international/index.rss',
      'https://www.france24.com/en/europe/rss'
    ]
  },

  {
    id: 'latam',
    label: 'Latin America',
    blurb: 'Central and South America.',
    accent: '#059669',
    feeds: [
      'https://feeds.bbci.co.uk/news/world/latin_america/rss.xml',
      'https://www.theguardian.com/world/americas/rss',
      'https://rss.nytimes.com/services/xml/rss/nyt/Americas.xml',
      'https://www.france24.com/en/americas/rss'
    ]
  },

  {
    id: 'oceania',
    label: 'Australia',
    blurb: 'Australia, New Zealand and the Pacific.',
    accent: '#0d9488',
    feeds: [
      'https://www.theguardian.com/australia-news/rss',
      'https://www.smh.com.au/rss/feed.xml',
      'https://feeds.bbci.co.uk/news/world/australia/rss.xml'
    ]
  }
];

export const TOPIC_IDS = TOPICS.map((t) => t.id);
export const TOPIC_BY_ID = Object.fromEntries(TOPICS.map((t) => [t.id, t]));
