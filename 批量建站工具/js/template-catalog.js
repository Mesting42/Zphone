/**
 * 扩展模板的声明式目录。
 * 布局记录只定义内容组织方式；领域记录只定义行业语汇、图形和视觉基调。
 * 实际 HTML/CSS 由 template-layouts.js 生成，广告配置继续由原生成器负责。
 */
(function(root) {
    'use strict';

    // 前 18 个布局供 36 个内容领域使用；后 8 个专用于独立游戏建站。
    // 每条记录都有分类标题、卡片排列和阅读页处理，不能用配色变体补数量。
    const layouts = [
        ['channel-rail', '频道侧轨', '编号频道标题、横向内容卡和侧边阅读信息', 'rail', 'landscape', 2, 'rail'],
        ['topic-matrix', '主题矩阵', '二维图文阵列、无框内容块和分区阅读标题', 'matrix', 'tiles', 3, 'band'],
        ['atlas-directory', '探索目录', '编号分类标题、纵向索引行和宽边阅读区', 'directory', 'rows', 1, 'index'],
        ['feature-deck', '专题展台', '块状专题标题、通栏图文交替和大图阅读页', 'deck', 'alternating', 1, 'stage'],
        ['signal-board', '频道速览', '粗线频道标题、大小组合内容块和摘要信息带', 'board', 'lead', 3, 'band'],
        ['pathway-guide', '路径导览', '竖线分类标题、编号分步区块和窄栏阅读', 'path', 'steps', 2, 'index'],
        ['topic-tower', '垂直频道', '大号分类编号、错位纵向内容列和侧翼信息区', 'tower', 'columns', 3, 'rail'],
        ['focus-canvas', '焦点视窗', '圆形分类编号、宽幅封面与独立正文面板', 'canvas', 'wide', 2, 'stage'],
        ['compact-register', '资料索引', '双线分类标题、紧凑缩略图行和清晰资料层级', 'register', 'register', 1, 'index'],
        ['ribbon-channels', '横带分区', '横带分类标题、反向图文带和全宽阅读标题', 'ribbon', 'ribbons', 2, 'band'],
        ['gateway-grid', '主题入口', '粗线分类标题、方形封面内容架和并列阅读信息', 'gateway', 'squares', 4, 'rail'],
        ['lens-collection', '视窗集合', '居中分类标题、圆形封面索引和居中阅读区', 'lens', 'circles', 3, 'center'],
        ['paired-streams', '双流浏览', '双线分区标题、成对图文行和分栏阅读信息', 'streams', 'pairs', 2, 'rail'],
        ['catalog-explorer', '分类浏览器', '底色分类标题、窄图条目和左侧资料栏', 'explorer', 'compact', 3, 'index'],
        ['chapter-panels', '专题面板', '大号分类编号、图文分屏和章节式阅读区', 'panels', 'panels', 2, 'stage'],
        ['horizon-shelves', '全景内容架', '全宽分类标题、宽封面横排和通栏阅读图', 'shelves', 'panorama', 2, 'stage'],
        ['radar-hub', '主题中枢', '细线分类标题、错位无框内容阵列和居中阅读区', 'radar', 'offset', 3, 'center'],
        ['modular-stack', '模块组合', '圆角分类标题、交替内容组件和模块化阅读区', 'modules', 'blocks', 3, 'band'],
        ['console-launcher', '主机启动台', '控制台编号标题、无框游戏阵列与宽幅游玩页', 'console', 'tiles', 3, 'stage'],
        ['quest-map', '任务路线', '竖线任务标题、编号游戏卡与分段游玩说明', 'quest', 'steps', 3, 'index'],
        ['match-lobby', '游戏大厅', '分区大厅标题、横向游戏列表与侧翼说明', 'lobby', 'landscape', 2, 'rail'],
        ['cartridge-shelf', '卡带陈列', '粗线分类标题、错位竖向封面架与中央游玩区', 'cartridge', 'columns', 3, 'center'],
        ['arena-brackets', '竞技分区', '竞技边框标题、成对游戏模块和聚焦详情页', 'brackets', 'pairs', 2, 'stage'],
        ['handheld-grid', '掌机视窗', '圆角分类标题、方形游戏视窗与分组说明区', 'handheld', 'squares', 3, 'band'],
        ['level-select', '关卡选择', '编号分类标题、矩形游戏单元和分段游玩说明', 'levels', 'blocks', 3, 'index'],
        ['speedrun-list', '快速选玩', '简洁分类标题、紧凑游戏清单与居中游玩页', 'speedrun', 'register', 1, 'center']
    ].map(function(row, index) {
        return Object.freeze({ id: 'portal-' + row[0], name: row[1], description: row[2],
            navigation: row[3], cards: row[4], columns: row[5], reader: row[6], index: index });
    });

    // 各领域使用自己的文字语境、非写实图形和配色范围。SVG 是装饰，不表示虚构数据。
    const domainRows = {
        tech: ['科技', 'Technology & systems', 'Explore hardware, software and the ideas shaping digital systems.', 'Technology channels', 'circuit', ['glacier','carbon','denim','celadon'], ['clean','tech','monospace'], ['技术','协议','设备','数字']],
        game: ['游戏', 'Games & play', 'Find your next game through genres, worlds and ways to play.', 'Game channels', 'controller', ['starry','carbon','glacier','neon'], ['tech','clean','display'], ['游戏','玩家','关卡','游玩']],
        food: ['美食', 'Food & flavor', 'Discover ingredients, kitchen techniques and food traditions.', 'Kitchen topics', 'dish', ['minimal','mint','amber','jade'], ['clean','rounded','modern'], ['风味','食材','厨房','料理']],
        anime: ['动漫', 'Animation & worlds', 'Explore animation, characters and the worlds behind the stories.', 'Animation channels', 'spark', ['glacier','lavender','twilight','minimaldark'], ['rounded','clean','display'], ['动画','角色','次元','创作']],
        finance: ['财经', 'Markets & business', 'Navigate business sectors, economic concepts and financial context.', 'Research topics', 'bars', ['denim','carbon','minimal','celadon'], ['clean','monospace','modern'], ['行业','经济','资本','企业']],
        health: ['健康', 'Health & wellbeing', 'Browse clear explanations of health, care and everyday wellbeing.', 'Health topics', 'cross', ['glacier','mint','minimal','lavender'], ['clean','rounded','modern'], ['健康','照护','生活','身心']],
        travel: ['旅行', 'Places & journeys', 'Discover places, routes and practical travel perspectives.', 'Destination topics', 'compass', ['glacier','denim','desert','deepsea'], ['modern','clean','rounded'], ['目的地','旅途','路线','地域']],
        sports: ['体育', 'Sport & performance', 'Explore sports, training and the thinking behind the game.', 'Sport channels', 'track', ['carbon','glacier','lava','denim'], ['display','tech','clean'], ['赛场','运动','训练','竞技']],
        automotive: ['汽车', 'Vehicles & mobility', 'Explore vehicle technology, design and the changing world of mobility.', 'Motoring topics', 'wheel', ['carbon','glacier','crimson','denim'], ['tech','clean','display'], ['车型','动力','驾驶','出行']],
        education: ['教育', 'Learning & discovery', 'Find learning resources, study approaches and ideas worth exploring.', 'Learning topics', 'steps', ['glacier','denim','minimal','mint'], ['clean','rounded','modern'], ['学习','知识','课程','求知']],
        fashion: ['时尚', 'Style & design', 'Discover silhouettes, materials and the language of personal style.', 'Style topics', 'form', ['minimal','carbon','rosegold','lavender'], ['modern','clean','display'], ['形态','穿搭','材质','设计']],
        home: ['家居', 'Spaces & living', 'Explore rooms, materials and practical ideas for living spaces.', 'Living topics', 'room', ['minimal','glacier','jade','rosegold'], ['clean','modern','rounded'], ['空间','居住','家装','材质']],
        general: ['通用', 'Ideas & perspectives', 'Explore subjects, find useful context and follow your curiosity.', 'Browse topics', 'tiles', ['glacier','denim','minimal','carbon'], ['clean','modern','display'], ['主题','发现','内容','知识']],
        entertainment: ['娱乐', 'Culture & entertainment', 'Discover people, performances and the stories behind popular culture.', 'Culture channels', 'spotlight', ['twilight','glacier','carbon','sunset'], ['display','modern','clean'], ['文化','舞台','热点','人物']],
        film: ['影视', 'Cinema & screen', 'Explore films, filmmaking and the craft behind moving images.', 'Screen topics', 'frame', ['carbon','minimaldark','glacier','crimson'], ['display','clean','modern'], ['镜头','银幕','电影','制作']],
        music: ['音乐', 'Sound & listening', 'Explore musical styles, sound-making and listening culture.', 'Sound channels', 'wave', ['minimaldark','glacier','denim','twilight'], ['modern','tech','clean'], ['声场','曲风','节奏','声音']],
        books: ['阅读', 'Books & ideas', 'Explore books, authors and the ideas that connect them.', 'Reading topics', 'pages', ['minimal','denim','glacier','carbon'], ['clean','modern','rounded'], ['书目','作者','阅读','思想']],
        science: ['科学', 'Science & discovery', 'Explore disciplines, research questions and explanations of our world.', 'Research fields', 'orbit', ['glacier','denim','carbon','deepsea'], ['clean','monospace','tech'], ['学科','研究','实验','探索']],
        environment: ['生态', 'Planet & environment', 'Explore ecosystems, climate and the connections across our planet.', 'Environment topics', 'globe', ['deepsea','glacier','jade','denim'], ['clean','modern','rounded'], ['生态','气候','地球','环境']],
        politics: ['时政', 'Policy & public life', 'Explore institutions, public issues and the context behind policy.', 'Public affairs', 'pillars', ['denim','minimal','carbon','glacier'], ['clean','modern','display'], ['公共','政策','议题','制度']],
        legal: ['法律', 'Law & understanding', 'Browse legal concepts, institutions and rights in context.', 'Legal topics', 'balance', ['minimal','denim','carbon','glacier'], ['clean','modern','monospace'], ['法理','权利','法规','司法']],
        realestate: ['房产', 'Property & places', 'Explore homes, built environments and property perspectives.', 'Property topics', 'buildings', ['glacier','minimal','denim','celadon'], ['clean','modern','rounded'], ['房产','建筑','社区','居住']],
        career: ['职场', 'Work & careers', 'Explore professional skills, working life and career development.', 'Career topics', 'ladder', ['denim','minimal','glacier','carbon'], ['clean','modern','rounded'], ['职业','成长','技能','工作']],
        marketing: ['营销', 'Brands & audiences', 'Explore brands, communication channels and audience understanding.', 'Marketing topics', 'target', ['glacier','carbon','celadon','sunset'], ['modern','clean','display'], ['品牌','传播','受众','渠道']],
        ecommerce: ['电商', 'Commerce & retail', 'Explore products, retail operations and the changing commerce landscape.', 'Commerce topics', 'boxes', ['glacier','minimal','denim','mint'], ['clean','modern','rounded'], ['零售','商品','商业','消费']],
        pets: ['宠物', 'Companions & care', 'Discover animal behavior, everyday care and life with companions.', 'Companion topics', 'paw', ['mint','glacier','lavender','minimal'], ['rounded','clean','modern'], ['陪伴','养护','动物','行为']],
        parenting: ['亲子', 'Families & growing', 'Explore family life, child development and everyday parenting topics.', 'Family topics', 'together', ['lavender','mint','glacier','minimal'], ['rounded','clean','modern'], ['成长','家庭','亲子','陪伴']],
        outdoors: ['户外', 'Outside & exploration', 'Explore trails, outdoor skills and ways to experience the landscape.', 'Outdoor topics', 'mountain', ['denim','glacier','forest','desert'], ['modern','clean','display'], ['山野','路线','户外','探索']],
        photography: ['摄影', 'Light & image', 'Explore image-making, visual techniques and photographic perspectives.', 'Image topics', 'aperture', ['carbon','minimal','glacier','denim'], ['clean','modern','display'], ['光影','镜头','影像','构图']],
        history: ['历史', 'History & context', 'Explore periods, places and the connections behind historical change.', 'History topics', 'arch', ['denim','minimal','carbon','glacier'], ['clean','modern','display'], ['时代','文明','历史','地域']],
        agriculture: ['农业', 'Land & cultivation', 'Explore cultivation, agricultural systems and life connected to the land.', 'Agriculture topics', 'furrows', ['jade','glacier','forest','minimal'], ['clean','modern','rounded'], ['耕作','农技','土地','农产']],
        energy: ['能源', 'Energy & systems', 'Explore energy sources, infrastructure and the systems that power our world.', 'Energy topics', 'grid', ['glacier','carbon','celadon','denim'], ['tech','clean','monospace'], ['能源','电力','设施','系统']],
        naturalhistory: ['自然史与生物多样性', 'Natural history & biodiversity', 'Explore species, habitats and the living history of our planet.', 'Field guides & research', 'leaf', ['forest','moss','jade','amber'], ['clean','literary','modern'], ['物种','栖息地','谱系','保育']],
        marinescience: ['海洋与水域科学', 'Marine & aquatic science', 'Explore ocean systems, aquatic life and the research shaping healthier waters.', 'Marine research', 'wave', ['deepsea','ocean','tealnight','glacier'], ['tech','clean','monospace'], ['海洋','水域','海岸','蓝碳']],
        earthscience: ['地球与大气科学', 'Earth & atmospheric science', 'Explore the forces, records and weather systems shaping Earth.', 'Earth science fields', 'globe', ['glacier','desert','carbon','amber'], ['monospace','clean','tech'], ['地层','气候','观测','地球']],
        culturalheritage: ['文化遗产与传统工艺', 'Cultural heritage & craft', 'Explore objects, techniques and records that connect people across generations.', 'Heritage & craft', 'arch', ['newsprint','amber','porcelain','terracotta'], ['literary','display','clean'], ['遗产','工艺','文献','修复']]
    };
    const domains = {};
    Object.keys(domainRows).forEach(function(id) {
        const row = domainRows[id];
        domains[id] = Object.freeze({ id: id, label: row[0], eyebrow: row[1], introduction: row[2],
            topicsLabel: row[3], motif: row[4], palettes: row[5], fonts: row[6], vocabulary: row[7] });
    });
    function getLayout(id) { return layouts.find(function(layout) { return layout.id === id; }) || null; }
    function getDomain(id) { return domains[id] || domains.general; }

    function defaults(layout, domain, game) {
        return {
            selectedStyle: domain.palettes[layout.index % domain.palettes.length],
            fontStyle: domain.fonts[layout.index % domain.fonts.length],
            navbarStyle: layout.index % 3 === 0 ? 'normal' : 'glass-sticky',
            logoStyle: layout.index % 4 === 0 ? 'boxed' : 'text',
            cardBorder: ['thin','none','rounded'][layout.index % 3],
            cardRadius: ['4px','0','12px','16px'][layout.index % 4],
            cardHover: game ? 'float' : 'accent-line',
            categoryTitleStyle: 'none', categoryTitleAlign: 'left',
            cardImageHeight: ['180px','220px','150px','260px'][layout.index % 4],
            contentMaxWidth: layout.navigation === 'register' ? '1100px' : '1400px',
            cardSpacing: '20px', gridGap: '20px',
            cardViewMode: 'card', detailLayout: 'single',
            detailImgStyle: layout.reader === 'stage' ? 'banner' : 'centered',
            metaLayout: layout.reader === 'index' ? 'list' : 'grid',
            btnStyle: layout.index % 2 ? 'outline' : 'solid', btnSize: 'medium',
            heroStyle: 'solid', animationEnter: 'none', transitionSpeed: '0.2s'
        };
    }

    function extendDomains(catalog, presets, brands, iconPools) {
        Object.keys(catalog).forEach(function(domainId) {
            const domain = getDomain(domainId);
            layouts.slice(0, 18).forEach(function(layout, offset) {
                const variant = offset + 13;
                const id = domainId + '-blueprint-' + String(variant).padStart(2, '0');
                if (presets.some(function(item) { return item.id === id; })) return;
                const brand = brands[domainId][variant - 1];
                const icons = iconPools[domainId];
                presets.push({
                    id: id, domainId: domainId, variant: variant,
                    name: domain.label + '·' + domain.vocabulary[offset % 4] + layout.name,
                    icon: icons[offset % icons.length], description: layout.description,
                    brand: { id: brand.id, siteTitle: brand.siteTitle, logoText: brand.logoText },
                    structure: { homeLayout: layout.id, templateDomain: domainId,
                        heroEnabled: false, navbarLayout: 'normal', cardColumns: String(layout.columns),
                        footerStyle: offset % 2 ? 'detailed' : 'simple', metaLayout: 'grid', detailLayout: 'single' },
                    style: defaults(layout, domain, false)
                });
                catalog[domainId].blueprints.push(id);
            });
        });
    }

    function gamePresets() {
        return layouts.map(function(layout) {
            return { id: layout.id, name: layout.index < 18 ? '游戏·' + layout.name : layout.name,
                desc: layout.description, previewClass: 'layout-preview-portal',
                style: Object.assign(defaults(layout, domains.game, true), { cardColumns: String(layout.columns), ambientEffect: 'none' }) };
        });
    }

    root.TemplateCatalog = Object.freeze({ layouts: layouts, domains: domains,
        getLayout: getLayout, getDomain: getDomain, extendDomains: extendDomains, gamePresets: gamePresets });
})(typeof globalThis !== 'undefined' ? globalThis : this);
