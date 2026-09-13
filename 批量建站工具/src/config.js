import { CONFIG_VERSION } from './core/utils.js';

export const TOPICS = {
  tech: { label: '科技资讯', english: 'Technology', icon: '💻', categories: ['Hardware', 'Software', 'AI & Machine Learning', 'Cybersecurity', 'Industry'] },
  game: { label: '游戏资讯', english: 'Games', icon: '🎮', categories: ['Action', 'Puzzle', 'Adventure', 'Arcade', 'Strategy'] },
  food: { label: '美食资讯', english: 'Food', icon: '🍽️', categories: ['Quick Recipes', 'Traditional Cuisine', 'Desserts', 'Healthy Eating', 'World Cuisine'] },
  anime: { label: '动漫资讯', english: 'Anime', icon: '🌸', categories: ['Action', 'Romance', 'Fantasy', 'Sci-Fi', 'Slice of Life'] }
};

export const STYLE_PRESETS = {
  Starry: ['#0b1024', '#f5f3ff', '#8b9cff', '#171d38'],
  Cyberpunk: ['#101113', '#f6fffb', '#19e7a3', '#202328'],
  Minimal: ['#f5f3ee', '#1b211e', '#d25138', '#ffffff'],
  Dark: ['#151816', '#edf0eb', '#9fcf64', '#202521'],
  Forest: ['#edf1e7', '#173226', '#34785a', '#ffffff'],
  Ocean: ['#edf6f5', '#132c31', '#087b8a', '#ffffff'],
  Retro: ['#f7ecd0', '#33291d', '#b65032', '#fff9e8'],
  Gradient: ['#f1f4ff', '#202744', '#5a67d8', '#ffffff'],
  Aurora: ['#eaf4ed', '#17332d', '#3a9b7a', '#ffffff'],
  Lava: ['#fff0e9', '#361a14', '#c74626', '#ffffff'],
  Sunset: ['#fff1e1', '#3a2722', '#d46745', '#fffaf4'],
  Mint: ['#ecf8f2', '#18332b', '#198a65', '#ffffff']
};

export const REQUIRED_IDENTITY_FIELDS = [
  ['siteName', '真实站点名称'], ['tagline', '准确标语'], ['description', '站点描述'],
  ['baseUrl', '正式 HTTPS 域名'], ['publisherName', '真实运营者'], ['contactEmail', '真实联系邮箱'],
  ['copyrightOwner', '真实版权主体'], ['defaultAuthor', '真实默认作者'], ['editorialProcess', '编辑与核验流程'],
  ['contentOrigin', '内容来源说明'], ['targetRegions', '目标地区']
];

export const FIELD_DEFINITIONS = [
  ['title', '标题', true], ['content', '正文', true], ['image', '封面图', true], ['image_alt', '图片说明', false],
  ['excerpt', '摘要', false], ['category', '分类', true], ['slug', 'Slug', false], ['author', '作者', true],
  ['published_at', '发布日期', true], ['updated_at', '更新日期', false], ['sources', '来源', true],
  ['fact_checked_by', '事实核验者', true], ['fact_checked_at', '核验日期', true],
  ['cover_image_source', '封面权属说明', true]
];

export function createDefaultState() {
  return {
    version: CONFIG_VERSION,
    currentStep: 0,
    completedSteps: [],
    dirty: false,
    topic: 'tech',
    identity: {
      siteName: '', tagline: '', description: '', baseUrl: '', publisherName: '', contactEmail: '',
      copyrightOwner: '', defaultAuthor: '', editorialProcess: '', contentOrigin: '', targetRegions: '',
      address: '', phone: ''
    },
    data: { fileName: '', rows: [], fields: [], preview: [], warnings: [], images: [] },
    mapping: Object.fromEntries(FIELD_DEFINITIONS.map(([field]) => [field, field])),
    articles: [],
    quality: null,
    confirmations: { imageRights: false, sourceLinks: false, visualImages: false, externalLinks: false, cmp: false },
    appearance: {
      preset: 'Forest', navLayout: 'regular', footerLayout: 'detailed', homeLinkStyle: 'breadcrumb', hero: false,
      categories: [...TOPICS.tech.categories], cardsPerCategory: 6, columns: 'responsive', sort: 'date', seed: 'sitefoundry',
      metaLayout: 'list', markdown: true, relatedCount: 4, radius: 14, shadow: true, density: 'comfortable', animation: true
    },
    policy: {
      privacyEffectiveDate: '', analyticsEnabled: false, formEndpoint: '', adsenseVerification: '', publisherId: '',
      adsTxt: '', adMode: 'auto', adSlot: '', adsEnabled: false, personalizedAds: false
    },
    preview: { page: 'home', viewport: 'desktop', articleIndex: 0 },
    audit: null
  };
}
