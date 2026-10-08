/**
 * 游戏站数据预设配置
 * 包含：游戏站主题定义、样式预设、页面内容预设
 */

// ========== 游戏站主题定义 ==========
const THEMES = {
    game: {
        id: 'game',
        name: '游戏站',
        siteTitle: 'GameHub',
        siteSubtitle: 'Discover Amazing Games',
        logoText: 'GameHub',
        // 字段定义（使用标准字段ID，通过fieldMapping映射到gamesData.json的实际字段）
        fields: [
            { id: 'title', label: 'Title', labelZh: '游戏标题', required: true, detailDisplay: 'main-title' },
            { id: 'content', label: 'Content', labelZh: '游戏描述', required: true, detailDisplay: 'body' },
            { id: 'image', label: 'Image', labelZh: '游戏缩略图', required: false, detailDisplay: 'hero-image' },
            { id: 'store_url', label: 'Game URL', labelZh: '游戏链接', required: true, detailDisplay: 'action-btn' },
            { id: 'id', label: 'ID', labelZh: '游戏ID', required: false, detailDisplay: 'filename' }
        ],
        // 首页分类预设
        categories: [
            { name: 'Action Games', icon: '⚔️', count: 2 },
            { name: 'Puzzle Games', icon: '🧩', count: 6 },
            { name: 'Adventure Games', icon: '🗺️', count: 6 },
            { name: 'Arcade Games', icon: '👾', count: 6 },
            { name: 'Strategy Games', icon: '🎯', count: 6 }
        ],
        // Hero预设
        hero: {
            title: 'Discover Your Next Adventure',
            subtitle: 'Explore the latest games and play instantly in your browser',
            bgStyle: 'linear-gradient(135deg, #0d0d0d 0%, #2d1b4e 50%, #1a0a2e 100%)'
        },
        // 卡片展示字段预设
        cardFields: ['image', 'title', 'content'],
        // 推荐卡片展示字段预设
        relatedCardFields: ['image', 'title'],
        // 详情页预设
        detail: {
            contentRender: 'text',
            actionButton: { enabled: true, text: 'Play Now', linkField: 'store_url' },
            metaLayout: 'grid'
        },
        // 通用页面内容
        pages: {
            about: {
                title: 'About GameHub',
                intro: 'GameHub is your ultimate destination for browser-based gaming. From action-packed adventures to brain-teasing puzzles, we curate the best games that you can play instantly — no downloads required.',
                mission: 'Our mission is to connect gamers with high-quality games they can enjoy anytime, anywhere. We believe great gaming should be accessible to everyone, and we work tirelessly to bring you the most fun and engaging experiences on the web.',
                email: 'contact@gamehub.com',
                address: '456 Gaming Boulevard, Los Angeles, CA 90028'
            },
            contact: {
                title: 'Contact Us',
                desc: 'Have a game suggestion, feedback, or want to collaborate? We\'d love to hear from you.',
                email: 'contact@gamehub.com',
                address: '456 Gaming Boulevard, Los Angeles, CA 90028'
            },
            privacy: {
                title: 'Privacy Policy',
                brief: `<p>Last updated: January 2026</p>
<p>At GameHub, we value your privacy. This Privacy Policy explains how we collect, use, and protect your personal information when you visit our website.</p>
<h2>Information We Collect</h2>
<p>We may collect certain information automatically, including your IP address, browser type, device information, and browsing patterns through cookies and similar technologies.</p>
<h2>How We Use Your Information</h2>
<p>We use the information we collect to improve our game library, personalize your experience, and analyze website traffic.</p>
<h2>Contact Us</h2>
<p>If you have questions about this Privacy Policy, please contact us at contact@gamehub.com.</p>`,
                full: `<p>Last updated: January 2026</p>
<p>At GameHub ("we," "our," or "us"), we are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website.</p>
<h2>1. Information We Collect</h2>
<p><strong>Automatically Collected Information:</strong> When you visit our website, we may automatically collect certain information about your device, including your IP address, browser type, operating system, referring URLs, and information about how you interact with the website and games.</p>
<p><strong>Cookies and Tracking:</strong> We use cookies and similar tracking technologies to track activity on our website and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.</p>
<h2>2. How We Use Your Information</h2>
<p>We use the information we collect for various purposes, including:</p>
<ul>
<li>To provide, operate, and maintain our gaming platform</li>
<li>To improve, personalize, and expand our game library</li>
<li>To understand and analyze how you use our website</li>
<li>To develop new features and functionality</li>
<li>To communicate with you for customer service and support</li>
<li>To detect and prevent fraud</li>
</ul>
<h2>3. Third-Party Services</h2>
<p>We may use third-party services such as Google Analytics to monitor and analyze the use of our website. Our games may be hosted on third-party servers, which have their own privacy policies.</p>
<h2>4. Data Security</h2>
<p>We implement appropriate technical and organizational security measures to protect your personal information. However, no method of transmission over the Internet or electronic storage is 100% secure.</p>
<h2>5. Your Rights</h2>
<p>You have the right to access, update, or delete your personal information. You may also request that we stop processing your personal data at any time.</p>
<h2>6. Changes to This Privacy Policy</h2>
<p>We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.</p>
<h2>7. Contact Us</h2>
<p>If you have any questions about this Privacy Policy, please contact us at contact@gamehub.com.</p>`
            },
            terms: {
                title: 'Terms of Service',
                brief: `<p>Last updated: January 2026</p>
<p>Welcome to GameHub. By accessing our website, you agree to these terms of service.</p>
<h2>Use of Our Website</h2>
<p>You may use our website for lawful purposes only. You agree not to use the website in any way that could damage or impair its operation.</p>
<h2>External Links</h2>
<p>Our website contains links to external game servers. We are not responsible for the content or practices of these external sites.</p>
<h2>Contact</h2>
<p>For questions about these Terms, contact us at contact@gamehub.com.</p>`,
                full: `<p>Last updated: January 2026</p>
<p>Welcome to GameHub ("we," "our," or "us"). By accessing or using our website, you agree to be bound by these Terms of Service.</p>
<h2>1. Acceptance of Terms</h2>
<p>By accessing and using GameHub, you accept and agree to be bound by the terms and provision of this agreement.</p>
<h2>2. Description of Service</h2>
<p>GameHub provides a curated collection of browser-based games for entertainment purposes. We reserve the right to modify or discontinue any game or the service at any time without notice.</p>
<h2>3. Use of Our Website</h2>
<p>You agree to use our website only for lawful purposes and in a way that does not infringe the rights of, restrict, or inhibit anyone else's use and enjoyment of the website and games. Prohibited activities include attempting to exploit game vulnerabilities, using cheats or hacks, or engaging in any form of harassment.</p>
<h2>4. Intellectual Property</h2>
<p>All content on this website, including but not limited to the website design, logo, and editorial content, is the property of GameHub. Game titles, thumbnails, and descriptions are sourced from their respective developers and are used for informational purposes.</p>
<h2>5. External Links Disclaimer</h2>
<p>Our website contains links to external game servers and third-party websites. We are not responsible for the content, privacy policies, or practices of these third-party sites. Games are provided "as is" without warranties of any kind.</p>
<h2>6. Disclaimer</h2>
<p>The games and information provided on this website are for entertainment purposes only. We make no representations or warranties of any kind about the availability, functionality, or safety of the games.</p>
<h2>7. Limitation of Liability</h2>
<p>In no event shall GameHub be liable for any indirect, incidental, special, consequential, or punitive damages arising out of your use of the website or games.</p>
<h2>8. Changes to Terms</h2>
<p>We reserve the right to modify these terms at any time. Your continued use of the website after any changes constitutes acceptance of the new terms.</p>
<h2>9. Contact</h2>
<p>If you have any questions about these Terms of Service, please contact us at contact@gamehub.com.</p>`
            }
        }
    }
};

// ========== 游戏站品牌与 Emoji 预设 ==========
// 均为通用英文组合词与系统 Emoji，不依赖外部字体或图标服务。
const GAME_BRAND_PRESETS = [
    'GameHub', 'PlayForge', 'PixelArcade', 'QuestNest', 'LevelRush',
    'JoyGrid', 'NovaPlay', 'ArcadeAtlas', 'GameHarbor', 'TurboQuest',
    'PixelRealm', 'PlayCircuit', 'QuestDeck', 'NeonJoystick', 'GameOrbit',
    'LevelLoom', 'PlayVault', 'ArcadePulse', 'SkillSprint', 'ByteBrawl',
    'QuestWave', 'JoyArena', 'PixelPilot', 'GameCove', 'ArcadeBloom',
    'LevelCraft', 'PlayFrontier', 'QuestStation', 'GameBeacon', 'PixelPort',
    'PlayNexus', 'ArcadeDrift', 'JoyQuest', 'GameTrail', 'LevelLab',
    'PlaySphere', 'QuestArc', 'PixelHaven', 'GameCurrent', 'ArcadeVista',
    'TurboPlay', 'QuestCore', 'JoyStack', 'PixelLeague', 'GameRoost',
    'PlaySummit', 'ArcadeFoundry', 'LevelDock', 'QuestGarden', 'GameSpark'
];

const GAME_EMOJI_ICONS = [
    '🎮', '🕹️', '👾', '🎯', '🏆', '⚔️', '🛡️', '🧩',
    '🎲', '🃏', '🏁', '🚀', '💥', '🔥', '⚡', '🌟',
    '💎', '💰', '🗝️', '🏹', '🎭', '🐉', '👻', '🏎️',
    '⚽', '🏀', '🎳', '⛳', '🥊', '🛸', '🤖', '👑',
    '🏰', '🗺️', '🧪', '🔮', '🧠', '🥇', '🎵', '🐲',
    '💪', '🏍️', '⛏️', '✨', '🎨', '💫', '🎪', '🎰'
];

// Keep category choices separate so richer game icons do not expand the brand-logo picker.
const GAME_CATEGORY_EMOJI_ICONS = GAME_EMOJI_ICONS.concat([
    '🧙', '🧛', '🧟', '🧚', '🧝', '🥷', '🧞', '🐺',
    '🦇', '🎴', '🪓', '🗡️', '🪃', '🧱', '🪙', '🧿',
    '🛠️', '🧵', '🪬', '🪵', '🪨', '🗿', '🥽', '🏯'
]);

// 24 套互不相同的游戏分类图标组合；支持整套切换，也支持单独改某一项。
const GAME_ICON_SET_PRESETS = Array.from({ length: 24 }, function(_, setIndex) {
    const steps = [1, 5, 7, 11, 13, 17];
    const step = steps[Math.floor(setIndex / 4) % steps.length];
    const start = (setIndex * 3) % GAME_CATEGORY_EMOJI_ICONS.length;
    return {
        id: 'game-icons-' + String(setIndex + 1).padStart(2, '0'),
        name: '游戏图标组合 ' + String(setIndex + 1).padStart(2, '0'),
        icons: Array.from({ length: 16 }, function(__, iconIndex) {
            return GAME_CATEGORY_EMOJI_ICONS[(start + iconIndex * step) % GAME_CATEGORY_EMOJI_ICONS.length];
        })
    };
});

// ========== 页面布局模板 ==========
// 所有模板都遵守：首页首组 2 个重点游戏，后续分组每组 6 个；详情页以单栏为主。
const LAYOUT_PRESETS = [
    {
        id: 'classic',
        name: '经典门户',
        desc: '稳重卡片网格，信息清晰',
        previewClass: 'layout-preview-classic'
    },
    {
        id: 'poster',
        name: '海报画廊',
        desc: '图片主导，标题叠放在封面上',
        previewClass: 'layout-preview-poster'
    },
    {
        id: 'editorial',
        name: '编辑精选',
        desc: '杂志式分区与强标题层级',
        previewClass: 'layout-preview-editorial'
    },
    {
        id: 'arcade',
        name: '街机目录',
        desc: '编号卡片与紧凑目录节奏',
        previewClass: 'layout-preview-arcade'
    }
];

// ========== 样式预设 ==========
const STYLE_PRESETS = [
    {
        id: 'starry',
        name: '星空',
        vars: {
            '--color-bg': '#0a0e27',
            '--color-bg-secondary': '#0f1640',
            '--color-surface': '#1a237e',
            '--color-primary': '#7c4dff',
            '--color-primary-light': '#b388ff',
            '--color-text': '#e8eaf6',
            '--color-text-secondary': '#9fa8da',
            '--color-card-bg': '#141937',
            '--color-border': '#3949ab',
            '--color-btn-bg': 'linear-gradient(135deg, #7c4dff, #448aff)',
            '--color-btn-text': '#fff',
            '--color-link': '#82b1ff',
            '--color-nav-bg': 'rgba(10, 14, 39, 0.95)',
            '--color-footer-bg': '#050816',
            '--card-radius': '8px'
        },
        previewBg: 'linear-gradient(135deg, #0a0e27, #1a237e)'
    },
    {
        id: 'cyberpunk',
        name: '赛博朋克',
        vars: {
            '--color-bg': '#0a0a0a',
            '--color-bg-secondary': '#1a0a2e',
            '--color-surface': '#2d1b4e',
            '--color-primary': '#ff00ff',
            '--color-primary-light': '#ff66ff',
            '--color-text': '#f0f0f0',
            '--color-text-secondary': '#b0b0b0',
            '--color-card-bg': '#1a1a2e',
            '--color-border': '#ff00ff',
            '--color-btn-bg': 'linear-gradient(135deg, #ff00ff, #00ffff)',
            '--color-btn-text': '#000',
            '--color-link': '#00ffff',
            '--color-nav-bg': 'rgba(10, 10, 10, 0.95)',
            '--color-footer-bg': '#050005',
            '--card-radius': '4px'
        },
        previewBg: 'linear-gradient(135deg, #0a0a0a, #2d1b4e)'
    },
    {
        id: 'minimal',
        name: '极简白',
        vars: {
            '--color-bg': '#ffffff',
            '--color-bg-secondary': '#f5f5f5',
            '--color-surface': '#e8e8e8',
            '--color-primary': '#333333',
            '--color-primary-light': '#666666',
            '--color-text': '#1a1a1a',
            '--color-text-secondary': '#666666',
            '--color-card-bg': '#ffffff',
            '--color-border': '#e0e0e0',
            '--color-btn-bg': 'linear-gradient(135deg, #333, #555)',
            '--color-btn-text': '#fff',
            '--color-link': '#333',
            '--color-nav-bg': 'rgba(255, 255, 255, 0.98)',
            '--color-footer-bg': '#f0f0f0',
            '--card-radius': '8px'
        },
        previewBg: 'linear-gradient(135deg, #fff, #f5f5f5)'
    },
    {
        id: 'dark',
        name: '暗夜',
        vars: {
            '--color-bg': '#121212',
            '--color-bg-secondary': '#1e1e1e',
            '--color-surface': '#2d2d2d',
            '--color-primary': '#bb86fc',
            '--color-primary-light': '#d4aaff',
            '--color-text': '#e0e0e0',
            '--color-text-secondary': '#a0a0a0',
            '--color-card-bg': '#1e1e1e',
            '--color-border': '#3d3d3d',
            '--color-btn-bg': 'linear-gradient(135deg, #bb86fc, #6200ee)',
            '--color-btn-text': '#fff',
            '--color-link': '#bb86fc',
            '--color-nav-bg': 'rgba(18, 18, 18, 0.95)',
            '--color-footer-bg': '#0a0a0a',
            '--card-radius': '12px'
        },
        previewBg: 'linear-gradient(135deg, #121212, #2d2d2d)'
    },
    {
        id: 'forest',
        name: '森林',
        vars: {
            '--color-bg': '#0a1f0a',
            '--color-bg-secondary': '#132613',
            '--color-surface': '#1b4332',
            '--color-primary': '#52b788',
            '--color-primary-light': '#74c69d',
            '--color-text': '#d8f3dc',
            '--color-text-secondary': '#95d5b2',
            '--color-card-bg': '#1b4332',
            '--color-border': '#2d6a4f',
            '--color-btn-bg': 'linear-gradient(135deg, #52b788, #2d6a4f)',
            '--color-btn-text': '#fff',
            '--color-link': '#74c69d',
            '--color-nav-bg': 'rgba(10, 31, 10, 0.95)',
            '--color-footer-bg': '#051005',
            '--card-radius': '8px'
        },
        previewBg: 'linear-gradient(135deg, #0a1f0a, #1b4332)'
    },
    {
        id: 'ocean',
        name: '海洋',
        vars: {
            '--color-bg': '#0a1628',
            '--color-bg-secondary': '#0f2139',
            '--color-surface': '#1a3a5c',
            '--color-primary': '#4cc9f0',
            '--color-primary-light': '#89d8f5',
            '--color-text': '#e0f0ff',
            '--color-text-secondary': '#a0c4e8',
            '--color-card-bg': '#0f2139',
            '--color-border': '#2a5a8c',
            '--color-btn-bg': 'linear-gradient(135deg, #4cc9f0, #3a86ff)',
            '--color-btn-text': '#fff',
            '--color-link': '#4cc9f0',
            '--color-nav-bg': 'rgba(10, 22, 40, 0.95)',
            '--color-footer-bg': '#050c18',
            '--card-radius': '8px'
        },
        previewBg: 'linear-gradient(135deg, #0a1628, #1a3a5c)'
    },
    {
        id: 'retro',
        name: '复古',
        vars: {
            '--color-bg': '#2c1810',
            '--color-bg-secondary': '#3d2517',
            '--color-surface': '#5c3a28',
            '--color-primary': '#d4a574',
            '--color-primary-light': '#e8c9a0',
            '--color-text': '#f5e6d3',
            '--color-text-secondary': '#c4a882',
            '--color-card-bg': '#3d2517',
            '--color-border': '#7a5038',
            '--color-btn-bg': 'linear-gradient(135deg, #d4a574, #8b5e3c)',
            '--color-btn-text': '#2c1810',
            '--color-link': '#d4a574',
            '--color-nav-bg': 'rgba(44, 24, 16, 0.95)',
            '--color-footer-bg': '#1a0e08',
            '--card-radius': '4px'
        },
        previewBg: 'linear-gradient(135deg, #2c1810, #5c3a28)'
    },
    {
        id: 'gradient',
        name: '渐变流光',
        vars: {
            '--color-bg': '#0f0c29',
            '--color-bg-secondary': '#1a1440',
            '--color-surface': '#302b63',
            '--color-primary': '#6c63ff',
            '--color-primary-light': '#9d96ff',
            '--color-text': '#f0ecff',
            '--color-text-secondary': '#b8b0e8',
            '--color-card-bg': '#1a1440',
            '--color-border': '#4a42a0',
            '--color-btn-bg': 'linear-gradient(135deg, #6c63ff, #e942f5)',
            '--color-btn-text': '#fff',
            '--color-link': '#9d96ff',
            '--color-nav-bg': 'rgba(15, 12, 41, 0.95)',
            '--color-footer-bg': '#08061a',
            '--card-radius': '12px'
        },
        previewBg: 'linear-gradient(135deg, #0f0c29, #302b63)'
    },
    {
        id: 'aurora',
        name: '极光',
        vars: {
            '--color-bg': '#0b0c10',
            '--color-bg-secondary': '#121820',
            '--color-surface': '#1f2833',
            '--color-primary': '#45f0a5',
            '--color-primary-light': '#7af5c2',
            '--color-text': '#e0f5ec',
            '--color-text-secondary': '#8fbfac',
            '--color-card-bg': '#162028',
            '--color-border': '#2d5040',
            '--color-btn-bg': 'linear-gradient(135deg, #45f0a5, #0abde3)',
            '--color-btn-text': '#0b0c10',
            '--color-link': '#45f0a5',
            '--color-nav-bg': 'rgba(11, 12, 16, 0.95)',
            '--color-footer-bg': '#050608',
            '--card-radius': '8px'
        },
        previewBg: 'linear-gradient(135deg, #0b0c10, #1f2833)'
    },
    {
        id: 'lava',
        name: '熔岩',
        vars: {
            '--color-bg': '#1a0a00',
            '--color-bg-secondary': '#2d1200',
            '--color-surface': '#4a1e00',
            '--color-primary': '#ff6b35',
            '--color-primary-light': '#ff9a6c',
            '--color-text': '#fff0e0',
            '--color-text-secondary': '#d4a882',
            '--color-card-bg': '#2d1200',
            '--color-border': '#8b3a00',
            '--color-btn-bg': 'linear-gradient(135deg, #ff6b35, #e63946)',
            '--color-btn-text': '#fff',
            '--color-link': '#ff9a6c',
            '--color-nav-bg': 'rgba(26, 10, 0, 0.95)',
            '--color-footer-bg': '#0a0500',
            '--card-radius': '8px'
        },
        previewBg: 'linear-gradient(135deg, #1a0a00, #4a1e00)'
    },
    {
        id: 'sunset',
        name: '日落',
        vars: {
            '--color-bg': '#1a0a1f',
            '--color-bg-secondary': '#2d1535',
            '--color-surface': '#4a2055',
            '--color-primary': '#ff6b9d',
            '--color-primary-light': '#ff9dc0',
            '--color-text': '#ffe8f0',
            '--color-text-secondary': '#d4a0b8',
            '--color-card-bg': '#2d1535',
            '--color-border': '#7a3060',
            '--color-btn-bg': 'linear-gradient(135deg, #ff6b9d, #c44569)',
            '--color-btn-text': '#fff',
            '--color-link': '#ff9dc0',
            '--color-nav-bg': 'rgba(26, 10, 31, 0.95)',
            '--color-footer-bg': '#0a050d',
            '--card-radius': '12px'
        },
        previewBg: 'linear-gradient(135deg, #1a0a1f, #4a2055)'
    },
    {
        id: 'mint',
        name: '薄荷',
        vars: {
            '--color-bg': '#0a1f1a',
            '--color-bg-secondary': '#0f2d25',
            '--color-surface': '#1a4a3a',
            '--color-primary': '#2dd4a8',
            '--color-primary-light': '#5eecc4',
            '--color-text': '#e0fff5',
            '--color-text-secondary': '#a0d8c8',
            '--color-card-bg': '#0f2d25',
            '--color-border': '#2d7a60',
            '--color-btn-bg': 'linear-gradient(135deg, #2dd4a8, #0ea882)',
            '--color-btn-text': '#0a1f1a',
            '--color-link': '#5eecc4',
            '--color-nav-bg': 'rgba(10, 31, 26, 0.95)',
            '--color-footer-bg': '#050f0c',
            '--card-radius': '8px'
        },
        previewBg: 'linear-gradient(135deg, #0a1f1a, #1a4a3a)'
    },
    {
        id: 'amber',
        name: '琥珀',
        vars: {
            '--color-bg': '#1a1505',
            '--color-bg-secondary': '#2d2510',
            '--color-surface': '#4a3d1a',
            '--color-primary': '#f5a623',
            '--color-primary-light': '#ffc55c',
            '--color-text': '#fff8e0',
            '--color-text-secondary': '#d4b870',
            '--color-card-bg': '#2d2510',
            '--color-border': '#8b7328',
            '--color-btn-bg': 'linear-gradient(135deg, #f5a623, #d4880f)',
            '--color-btn-text': '#1a1505',
            '--color-link': '#ffc55c',
            '--color-nav-bg': 'rgba(26, 21, 5, 0.95)',
            '--color-footer-bg': '#0a0800',
            '--card-radius': '8px'
        },
        previewBg: 'linear-gradient(135deg, #1a1505, #4a3d1a)'
    },
    {
        id: 'lavender',
        name: '薰衣草',
        vars: {
            '--color-bg': '#1a1028',
            '--color-bg-secondary': '#2d1a42',
            '--color-surface': '#4a2d6a',
            '--color-primary': '#a78bfa',
            '--color-primary-light': '#c4b5fd',
            '--color-text': '#f0e8ff',
            '--color-text-secondary': '#b8a0d8',
            '--color-card-bg': '#2d1a42',
            '--color-border': '#6a42a0',
            '--color-btn-bg': 'linear-gradient(135deg, #a78bfa, #7c3aed)',
            '--color-btn-text': '#fff',
            '--color-link': '#c4b5fd',
            '--color-nav-bg': 'rgba(26, 16, 40, 0.95)',
            '--color-footer-bg': '#0a0518',
            '--card-radius': '12px'
        },
        previewBg: 'linear-gradient(135deg, #1a1028, #4a2d6a)'
    },
    {
        id: 'sakura',
        name: '樱花',
        vars: {
            '--color-bg': '#1f0a18',
            '--color-bg-secondary': '#351528',
            '--color-surface': '#552040',
            '--color-primary': '#f472b6',
            '--color-primary-light': '#f9a8d4',
            '--color-text': '#ffe8f0',
            '--color-text-secondary': '#d4a0b8',
            '--color-card-bg': '#351528',
            '--color-border': '#a03070',
            '--color-btn-bg': 'linear-gradient(135deg, #f472b6, #db2777)',
            '--color-btn-text': '#fff',
            '--color-link': '#f9a8d4',
            '--color-nav-bg': 'rgba(31, 10, 24, 0.95)',
            '--color-footer-bg': '#0d050a',
            '--card-radius': '12px'
        },
        previewBg: 'linear-gradient(135deg, #1f0a18, #552040)'
    },
    {
        id: 'glacier',
        name: '冰川',
        vars: {
            '--color-bg': '#0a1520',
            '--color-bg-secondary': '#0f2030',
            '--color-surface': '#1a3550',
            '--color-primary': '#67e8f9',
            '--color-primary-light': '#a5f3fc',
            '--color-text': '#e0f8ff',
            '--color-text-secondary': '#90c8d8',
            '--color-card-bg': '#0f2030',
            '--color-border': '#2d5a78',
            '--color-btn-bg': 'linear-gradient(135deg, #67e8f9, #22d3ee)',
            '--color-btn-text': '#0a1520',
            '--color-link': '#a5f3fc',
            '--color-nav-bg': 'rgba(10, 21, 32, 0.95)',
            '--color-footer-bg': '#050a10',
            '--card-radius': '8px'
        },
        previewBg: 'linear-gradient(135deg, #0a1520, #1a3550)'
    },
    {
        id: 'desert',
        name: '沙漠',
        vars: {
            '--color-bg': '#1f1a10',
            '--color-bg-secondary': '#302818',
            '--color-surface': '#504020',
            '--color-primary': '#d4a04a',
            '--color-primary-light': '#e8c070',
            '--color-text': '#fff5e0',
            '--color-text-secondary': '#c0a070',
            '--color-card-bg': '#302818',
            '--color-border': '#806030',
            '--color-btn-bg': 'linear-gradient(135deg, #d4a04a, #b08030)',
            '--color-btn-text': '#1f1a10',
            '--color-link': '#e8c070',
            '--color-nav-bg': 'rgba(31, 26, 16, 0.95)',
            '--color-footer-bg': '#0f0c08',
            '--card-radius': '4px'
        },
        previewBg: 'linear-gradient(135deg, #1f1a10, #504020)'
    },
    {
        id: 'deepsea',
        name: '深海',
        vars: {
            '--color-bg': '#020c1b',
            '--color-bg-secondary': '#0a192f',
            '--color-surface': '#112240',
            '--color-primary': '#64ffda',
            '--color-primary-light': '#8affea',
            '--color-text': '#ccd6f6',
            '--color-text-secondary': '#8892b0',
            '--color-card-bg': '#0a192f',
            '--color-border': '#233554',
            '--color-btn-bg': 'linear-gradient(135deg, #64ffda, #0ea5e9)',
            '--color-btn-text': '#020c1b',
            '--color-link': '#64ffda',
            '--color-nav-bg': 'rgba(2, 12, 27, 0.95)',
            '--color-footer-bg': '#010610',
            '--card-radius': '8px'
        },
        previewBg: 'linear-gradient(135deg, #020c1b, #112240)'
    },
    {
        id: 'rosegold',
        name: '玫瑰金',
        vars: {
            '--color-bg': '#1a1015',
            '--color-bg-secondary': '#2d1a22',
            '--color-surface': '#4a2838',
            '--color-primary': '#e8a0b4',
            '--color-primary-light': '#f0c0d0',
            '--color-text': '#fff0f5',
            '--color-text-secondary': '#d0a0b0',
            '--color-card-bg': '#2d1a22',
            '--color-border': '#8a4058',
            '--color-btn-bg': 'linear-gradient(135deg, #e8a0b4, #c06080)',
            '--color-btn-text': '#1a1015',
            '--color-link': '#f0c0d0',
            '--color-nav-bg': 'rgba(26, 16, 21, 0.95)',
            '--color-footer-bg': '#0a050a',
            '--card-radius': '12px'
        },
        previewBg: 'linear-gradient(135deg, #1a1015, #4a2838)'
    },
    {
        id: 'carbon',
        name: '碳黑',
        vars: {
            '--color-bg': '#0d0d0d',
            '--color-bg-secondary': '#171717',
            '--color-surface': '#262626',
            '--color-primary': '#f97316',
            '--color-primary-light': '#fb923c',
            '--color-text': '#f5f5f5',
            '--color-text-secondary': '#a3a3a3',
            '--color-card-bg': '#171717',
            '--color-border': '#404040',
            '--color-btn-bg': 'linear-gradient(135deg, #f97316, #ea580c)',
            '--color-btn-text': '#fff',
            '--color-link': '#fb923c',
            '--color-nav-bg': 'rgba(13, 13, 13, 0.95)',
            '--color-footer-bg': '#050505',
            '--card-radius': '6px'
        },
        previewBg: 'linear-gradient(135deg, #0d0d0d, #262626)'
    },
    {
        id: 'jade',
        name: '翡翠',
        vars: {
            '--color-bg': '#0a1a15',
            '--color-bg-secondary': '#102d22',
            '--color-surface': '#1a4a35',
            '--color-primary': '#34d399',
            '--color-primary-light': '#6ee7b7',
            '--color-text': '#e0fff0',
            '--color-text-secondary': '#90c8a8',
            '--color-card-bg': '#102d22',
            '--color-border': '#2d7a58',
            '--color-btn-bg': 'linear-gradient(135deg, #34d399, #059669)',
            '--color-btn-text': '#0a1a15',
            '--color-link': '#6ee7b7',
            '--color-nav-bg': 'rgba(10, 26, 21, 0.95)',
            '--color-footer-bg': '#050d0a',
            '--card-radius': '8px'
        },
        previewBg: 'linear-gradient(135deg, #0a1a15, #1a4a35)'
    },
    {
        id: 'twilight',
        name: '黄昏',
        vars: {
            '--color-bg': '#1a1020',
            '--color-bg-secondary': '#2d1830',
            '--color-surface': '#4a2850',
            '--color-primary': '#c084fc',
            '--color-primary-light': '#d8b4fe',
            '--color-text': '#f5e8ff',
            '--color-text-secondary': '#b890d0',
            '--color-card-bg': '#2d1830',
            '--color-border': '#7040a0',
            '--color-btn-bg': 'linear-gradient(135deg, #c084fc, #9333ea)',
            '--color-btn-text': '#fff',
            '--color-link': '#d8b4fe',
            '--color-nav-bg': 'rgba(26, 16, 32, 0.95)',
            '--color-footer-bg': '#0a0510',
            '--card-radius': '10px'
        },
        previewBg: 'linear-gradient(135deg, #1a1020, #4a2850)'
    },
    {
        id: 'denim',
        name: '牛仔',
        vars: {
            '--color-bg': '#0f1525',
            '--color-bg-secondary': '#182040',
            '--color-surface': '#253060',
            '--color-primary': '#60a5fa',
            '--color-primary-light': '#93c5fd',
            '--color-text': '#e0ecff',
            '--color-text-secondary': '#90a8c8',
            '--color-card-bg': '#182040',
            '--color-border': '#3a5080',
            '--color-btn-bg': 'linear-gradient(135deg, #60a5fa, #3b82f6)',
            '--color-btn-text': '#fff',
            '--color-link': '#93c5fd',
            '--color-nav-bg': 'rgba(15, 21, 37, 0.95)',
            '--color-footer-bg': '#080c18',
            '--card-radius': '8px'
        },
        previewBg: 'linear-gradient(135deg, #0f1525, #253060)'
    },
    {
        id: 'crimson',
        name: '赤金',
        vars: {
            '--color-bg': '#1a0505',
            '--color-bg-secondary': '#2d0a0a',
            '--color-surface': '#4a1515',
            '--color-primary': '#ef4444',
            '--color-primary-light': '#f87171',
            '--color-text': '#fff0f0',
            '--color-text-secondary': '#d0a0a0',
            '--color-card-bg': '#2d0a0a',
            '--color-border': '#8b2020',
            '--color-btn-bg': 'linear-gradient(135deg, #ef4444, #b91c1c)',
            '--color-btn-text': '#fff',
            '--color-link': '#f87171',
            '--color-nav-bg': 'rgba(26, 5, 5, 0.95)',
            '--color-footer-bg': '#0a0202',
            '--card-radius': '6px'
        },
        previewBg: 'linear-gradient(135deg, #1a0505, #4a1515)'
    },
    {
        id: 'celadon',
        name: '青瓷',
        vars: {
            '--color-bg': '#0a1a1a',
            '--color-bg-secondary': '#0f2828',
            '--color-surface': '#1a4545',
            '--color-primary': '#5eead4',
            '--color-primary-light': '#99f6e4',
            '--color-text': '#e0fff8',
            '--color-text-secondary': '#90c8b8',
            '--color-card-bg': '#0f2828',
            '--color-border': '#2d7070',
            '--color-btn-bg': 'linear-gradient(135deg, #5eead4, #14b8a6)',
            '--color-btn-text': '#0a1a1a',
            '--color-link': '#99f6e4',
            '--color-nav-bg': 'rgba(10, 26, 26, 0.95)',
            '--color-footer-bg': '#050d0d',
            '--card-radius': '8px'
        },
        previewBg: 'linear-gradient(135deg, #0a1a1a, #1a4545)'
    },
    {
        id: 'minimaldark',
        name: '极简黑',
        vars: {
            '--color-bg': '#000000',
            '--color-bg-secondary': '#0a0a0a',
            '--color-surface': '#1a1a1a',
            '--color-primary': '#ffffff',
            '--color-primary-light': '#e0e0e0',
            '--color-text': '#f5f5f5',
            '--color-text-secondary': '#888888',
            '--color-card-bg': '#0a0a0a',
            '--color-border': '#333333',
            '--color-btn-bg': 'linear-gradient(135deg, #fff, #ccc)',
            '--color-btn-text': '#000',
            '--color-link': '#fff',
            '--color-nav-bg': 'rgba(0, 0, 0, 0.98)',
            '--color-footer-bg': '#000000',
            '--card-radius': '0px'
        },
        previewBg: 'linear-gradient(135deg, #000, #1a1a1a)'
    },
    {
        id: 'neon',
        name: '霓虹',
        vars: {
            '--color-bg': '#0a0a0a',
            '--color-bg-secondary': '#151515',
            '--color-surface': '#252525',
            '--color-primary': '#00ff88',
            '--color-primary-light': '#4dffaa',
            '--color-text': '#f0fff5',
            '--color-text-secondary': '#80c898',
            '--color-card-bg': '#151515',
            '--color-border': '#00ff88',
            '--color-btn-bg': 'linear-gradient(135deg, #00ff88, #00cc6a)',
            '--color-btn-text': '#0a0a0a',
            '--color-link': '#00ff88',
            '--color-nav-bg': 'rgba(10, 10, 10, 0.95)',
            '--color-footer-bg': '#050505',
            '--card-radius': '4px'
        },
        previewBg: 'linear-gradient(135deg, #0a0a0a, #252525)'
    }
];

// 明确围绕游戏类型设计的扩展色板。保留相同的变量契约，供预览与导出共用。
function createGameStylePreset(id, name, palette, previewBg) {
    return {
        id: id,
        name: name,
        vars: {
            '--color-bg': palette.bg,
            '--color-bg-secondary': palette.bgSecondary,
            '--color-surface': palette.surface,
            '--color-primary': palette.primary,
            '--color-primary-light': palette.primaryLight,
            '--color-text': palette.text,
            '--color-text-secondary': palette.textSecondary,
            '--color-card-bg': palette.cardBg,
            '--color-border': palette.border,
            '--color-btn-bg': 'linear-gradient(135deg, ' + palette.primary + ', ' + palette.primaryLight + ')',
            '--color-btn-text': palette.buttonText,
            '--color-link': palette.primaryLight,
            '--color-nav-bg': palette.navBg,
            '--color-footer-bg': palette.footerBg,
            '--card-radius': palette.radius
        },
        previewBg: previewBg
    };
}

STYLE_PRESETS.push(
    createGameStylePreset('laser-grid', '激光矩阵', {
        bg: '#06131f', bgSecondary: '#092334', surface: '#10435b', primary: '#28d7ff', primaryLight: '#8af0ff',
        text: '#e7fbff', textSecondary: '#9bc9d3', cardBg: '#092030', border: '#1c6a85', buttonText: '#03131c',
        navBg: 'rgba(6, 19, 31, .96)', footerBg: '#030a10', radius: '6px'
    }, 'linear-gradient(135deg, #06131f 0%, #10435b 52%, #071a2b 100%)'),
    createGameStylePreset('boss-rush', '首领突袭', {
        bg: '#19080d', bgSecondary: '#2a0d17', surface: '#541625', primary: '#ff4d6d', primaryLight: '#ff98aa',
        text: '#fff0f3', textSecondary: '#d8a0ad', cardBg: '#280d16', border: '#9a2b41', buttonText: '#23050b',
        navBg: 'rgba(25, 8, 13, .96)', footerBg: '#0b0305', radius: '8px'
    }, 'linear-gradient(135deg, #19080d 0%, #6b1429 55%, #250913 100%)'),
    createGameStylePreset('loot-gold', '战利品金', {
        bg: '#181305', bgSecondary: '#29200a', surface: '#534118', primary: '#f6c945', primaryLight: '#ffe28a',
        text: '#fff9df', textSecondary: '#d7c487', cardBg: '#271f0b', border: '#9f7c23', buttonText: '#1a1303',
        navBg: 'rgba(24, 19, 5, .96)', footerBg: '#0a0801', radius: '10px'
    }, 'linear-gradient(135deg, #181305 0%, #6b5317 52%, #2b2107 100%)'),
    createGameStylePreset('toxic-slime', '毒液绿', {
        bg: '#0b1205', bgSecondary: '#13220a', surface: '#294614', primary: '#b8ff3d', primaryLight: '#dcff8c',
        text: '#f2ffe0', textSecondary: '#b3cc87', cardBg: '#13200b', border: '#5e8e26', buttonText: '#111a04',
        navBg: 'rgba(11, 18, 5, .96)', footerBg: '#050900', radius: '12px'
    }, 'linear-gradient(135deg, #0b1205 0%, #426d18 54%, #142606 100%)'),
    createGameStylePreset('spacefleet', '星际舰队', {
        bg: '#080d22', bgSecondary: '#10183a', surface: '#26366f', primary: '#8c9eff', primaryLight: '#c1cbff',
        text: '#eff1ff', textSecondary: '#adb5e6', cardBg: '#101735', border: '#4f62b4', buttonText: '#0a0d22',
        navBg: 'rgba(8, 13, 34, .96)', footerBg: '#030511', radius: '8px'
    }, 'linear-gradient(135deg, #080d22 0%, #303d82 54%, #101736 100%)'),
    createGameStylePreset('pixel-candy', '像素糖果', {
        bg: '#200b2a', bgSecondary: '#351142', surface: '#69205e', primary: '#ff7bd5', primaryLight: '#ffc0ee',
        text: '#fff0fb', textSecondary: '#e1a9d2', cardBg: '#33103f', border: '#a23590', buttonText: '#2b0827',
        navBg: 'rgba(32, 11, 42, .96)', footerBg: '#100414', radius: '14px'
    }, 'linear-gradient(135deg, #200b2a 0%, #8c256e 50%, #2c1046 100%)'),
    createGameStylePreset('racing-redline', '红线竞速', {
        bg: '#150b0a', bgSecondary: '#281210', surface: '#51221b', primary: '#ff623d', primaryLight: '#ffad76',
        text: '#fff2ec', textSecondary: '#d9afa0', cardBg: '#25100f', border: '#983b2b', buttonText: '#220b06',
        navBg: 'rgba(21, 11, 10, .96)', footerBg: '#090403', radius: '4px'
    }, 'linear-gradient(135deg, #150b0a 0%, #7d2417 50%, #24100b 100%)'),
    createGameStylePreset('void-terminal', '虚空终端', {
        bg: '#090610', bgSecondary: '#140d22', surface: '#2d1742', primary: '#ee5cff', primaryLight: '#ffadff',
        text: '#fbf0ff', textSecondary: '#cfa6d8', cardBg: '#130c20', border: '#71308c', buttonText: '#19051d',
        navBg: 'rgba(9, 6, 16, .96)', footerBg: '#030104', radius: '2px'
    }, 'linear-gradient(135deg, #090610 0%, #481a62 52%, #140d22 100%)'),
    createGameStylePreset('royal-quest', '王国冒险', {
        bg: '#0d1820', bgSecondary: '#142837', surface: '#245165', primary: '#5ac8fa', primaryLight: '#b1e8ff',
        text: '#effaff', textSecondary: '#a8c9d6', cardBg: '#122532', border: '#34738d', buttonText: '#061923',
        navBg: 'rgba(13, 24, 32, .96)', footerBg: '#061015', radius: '10px'
    }, 'linear-gradient(135deg, #0d1820 0%, #27657a 50%, #153548 100%)')
);

// 原有 4 个布局保持不变，新增布局共享内容渲染器。
LAYOUT_PRESETS.push(...TemplateCatalog.gamePresets());
