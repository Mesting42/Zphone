/**
 * 数据预设配置
 * 包含：主题定义、样式预设、页面内容预设
 */

// ========== 主题定义 ==========
const THEMES = {
    tech: {
        id: 'tech',
        name: '科技资讯',
        siteTitle: 'Technology News',
        siteSubtitle: 'Your Source for Technology Insights',
        logoText: 'TechNews',
        // 预设字段定义
        fields: [
            { id: 'title', label: 'Title', labelZh: '文章标题', required: true, detailDisplay: 'main-title' },
            { id: 'content', label: 'Content', labelZh: '文章正文', required: true, detailDisplay: 'body' },
            { id: 'image', label: 'Image', labelZh: '文章头图', required: false, detailDisplay: 'hero-image' },
            { id: 'excerpt', label: 'Excerpt', labelZh: '文章摘要', required: false, detailDisplay: 'excerpt' },
            { id: 'id', label: 'ID', labelZh: '文章ID', required: false, detailDisplay: 'filename' }
        ],
        // 首页分类预设
        categories: [
            { name: 'Tech Hardware News', icon: '💻', count: 2 },
            { name: 'Software Update News', icon: '📱', count: 6 },
            { name: 'AI & ML News', icon: '🤖', count: 6 },
            { name: 'Cybersecurity News', icon: '🔒', count: 6 },
            { name: 'Tech Industry News', icon: '🏢', count: 6 }
        ],
        iconPool: ['💻', '📱', '🤖', '🔒', '🏢', '🧠', '⚙️', '🛰️', '💡', '🧪', '🌐', '📡', '🔋', '🛠️', '🖥️', '🧬', '🧮', '🔬', '📟', '🛡️', '⚡', '📲', '🗜️', '🔌'],
        // Hero预设
        hero: {
            title: 'Explore the Future of Technology',
            subtitle: 'Stay ahead with the latest breakthroughs in AI, cybersecurity, and innovation',
            bgStyle: 'linear-gradient(135deg, #0a0e27 0%, #1a237e 50%, #0d47a1 100%)'
        },
        // 卡片展示字段预设
        cardFields: ['image', 'title', 'excerpt'],
        // 推荐卡片展示字段预设
        relatedCardFields: ['image', 'title', 'excerpt'],
        // 详情页预设
        detail: {
            contentRender: 'text',
            actionButton: { enabled: false, text: 'Read More', linkField: null },
            metaLayout: 'grid'
        },
        // 通用页面内容
        pages: {
            about: {
                title: 'About Technology News',
                intro: 'Technology News is your premier destination for the latest developments in the world of technology. We cover breakthroughs in artificial intelligence, cybersecurity, software development, and emerging tech trends that shape our future.',
                mission: 'Our mission is to make complex technology accessible to everyone, delivering in-depth analysis and up-to-date coverage of the innovations that matter.',
                email: 'contact@technologynews.com',
                address: '123 Tech Avenue, San Francisco, CA 94105'
            },
            contact: {
                title: 'Contact Us',
                desc: 'Have a story tip or want to reach out? We\'d love to hear from you.',
                email: 'contact@technologynews.com',
                address: '123 Tech Avenue, San Francisco, CA 94105'
            },
            privacy: {
                title: 'Privacy Policy',
                brief: `<p>Last updated: January 2026</p>
<p>At Technology News, we value your privacy. This Privacy Policy explains how we collect, use, and protect your personal information when you visit our website.</p>
<h2>Information We Collect</h2>
<p>We may collect certain information automatically, including your IP address, browser type, device information, and browsing patterns through cookies and similar technologies.</p>
<h2>How We Use Your Information</h2>
<p>We use the information we collect to improve our content, personalize your experience, and analyze website traffic.</p>
<h2>Contact Us</h2>
<p>If you have questions about this Privacy Policy, please contact us at contact@technologynews.com.</p>`,
                full: `<p>Last updated: January 2026</p>
<p>At Technology News ("we," "our," or "us"), we are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website.</p>
<h2>1. Information We Collect</h2>
<p><strong>Automatically Collected Information:</strong> When you visit our website, we may automatically collect certain information about your device, including your IP address, browser type, operating system, referring URLs, and information about how you interact with the website.</p>
<p><strong>Cookies and Tracking:</strong> We use cookies and similar tracking technologies to track activity on our website and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.</p>
<h2>2. How We Use Your Information</h2>
<p>We use the information we collect for various purposes, including:</p>
<ul>
<li>To provide, operate, and maintain our website</li>
<li>To improve, personalize, and expand our website</li>
<li>To understand and analyze how you use our website</li>
<li>To develop new products, services, features, and functionality</li>
<li>To communicate with you for customer service and support</li>
<li>To detect and prevent fraud</li>
</ul>
<h2>3. Third-Party Services</h2>
<p>We may use third-party services such as Google Analytics to monitor and analyze the use of our website. These third parties have their own privacy policies addressing how they use such information.</p>
<h2>4. Data Security</h2>
<p>We implement appropriate technical and organizational security measures to protect your personal information. However, no method of transmission over the Internet or electronic storage is 100% secure.</p>
<h2>5. Your Rights</h2>
<p>You have the right to access, update, or delete your personal information. You may also request that we stop processing your personal data at any time.</p>
<h2>6. Changes to This Privacy Policy</h2>
<p>We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.</p>
<h2>7. Contact Us</h2>
<p>If you have any questions about this Privacy Policy, please contact us at contact@technologynews.com.</p>`
            },
            terms: {
                title: 'Terms of Service',
                brief: `<p>Last updated: January 2026</p>
<p>Welcome to Technology News. By accessing our website, you agree to these terms of service.</p>
<h2>Use of Our Website</h2>
<p>You may use our website for lawful purposes only. You agree not to use the website in any way that could damage or impair its operation.</p>
<h2>Intellectual Property</h2>
<p>All content on this website, including articles, images, and design, is the property of Technology News and is protected by copyright laws.</p>
<h2>Contact</h2>
<p>For questions about these Terms, contact us at contact@technologynews.com.</p>`,
                full: `<p>Last updated: January 2026</p>
<p>Welcome to Technology News ("we," "our," or "us"). By accessing or using our website, you agree to be bound by these Terms of Service.</p>
<h2>1. Acceptance of Terms</h2>
<p>By accessing and using Technology News, you accept and agree to be bound by the terms and provision of this agreement.</p>
<h2>2. Description of Service</h2>
<p>Technology News provides technology-related news, articles, and information. We reserve the right to modify or discontinue the service at any time without notice.</p>
<h2>3. Use of Our Website</h2>
<p>You agree to use our website only for lawful purposes and in a way that does not infringe the rights of, restrict, or inhibit anyone else's use and enjoyment of the website.</p>
<h2>4. Intellectual Property</h2>
<p>All content published on this website, including but not limited to articles, graphics, logos, and design elements, is the property of Technology News and is protected by international copyright laws. You may not reproduce, distribute, or modify any content without our prior written permission.</p>
<h2>5. Disclaimer</h2>
<p>The information provided on this website is for general informational purposes only. We make no representations or warranties of any kind, express or implied, about the completeness, accuracy, or reliability of the information.</p>
<h2>6. Limitation of Liability</h2>
<p>In no event shall Technology News be liable for any indirect, incidental, special, consequential, or punitive damages arising out of your use of the website.</p>
<h2>7. Changes to Terms</h2>
<p>We reserve the right to modify these terms at any time. Your continued use of the website after any changes constitutes acceptance of the new terms.</p>
<h2>8. Contact</h2>
<p>If you have any questions about these Terms of Service, please contact us at contact@technologynews.com.</p>`
            }
        }
    },

    game: {
        id: 'game',
        name: '游戏资讯',
        siteTitle: 'GamesInfo',
        siteSubtitle: 'Discover Amazing Games',
        logoText: 'GameInfo',
        fields: [
            { id: 'title', label: 'Title', labelZh: '游戏标题', required: true, detailDisplay: 'main-title' },
            { id: 'content', label: 'Content', labelZh: '游戏介绍正文', required: true, detailDisplay: 'body' },
            { id: 'image', label: 'Image', labelZh: '游戏头图', required: false, detailDisplay: 'hero-image' },
            { id: 'developer', label: 'Developer', labelZh: '开发商', required: false, detailDisplay: 'meta' },
            { id: 'publisher', label: 'Publisher', labelZh: '发行商', required: false, detailDisplay: 'meta' },
            { id: 'genres', label: 'Genres', labelZh: '游戏类型', required: false, detailDisplay: 'card+meta' },
            { id: 'price', label: 'Price', labelZh: '价格', required: false, detailDisplay: 'card+meta', special: 'price-free' },
            { id: 'platforms', label: 'Platforms', labelZh: '平台', required: false, detailDisplay: 'meta' },
            { id: 'release_date', label: 'Release Date', labelZh: '发行日期', required: false, detailDisplay: 'meta' },
            { id: 'store_url', label: 'Store URL', labelZh: '商店链接', required: false, detailDisplay: 'action-btn' }
        ],
        categories: [
            { name: 'Action Games', icon: '⚔️', count: 2 },
            { name: 'Puzzle Games', icon: '🧩', count: 6 },
            { name: 'Adventure Games', icon: '🗺️', count: 6 },
            { name: 'Arcade Games', icon: '👾', count: 6 },
            { name: 'Strategy Games', icon: '🎯', count: 6 }
        ],
        iconPool: ['⚔️', '🧩', '🗺️', '👾', '♟️', '🎮', '🏆', '🛡️', '🧙', '🚀', '💥', '🎯', '🧟', '🐉', '🏹', '🎲', '🕹️', '🎰', '🧿', '🪄', '🏁', '💎', '🧗', '🏰'],
        hero: {
            title: 'Discover Your Next Adventure',
            subtitle: 'Explore the latest games, reviews, and gaming news from around the world',
            bgStyle: 'linear-gradient(135deg, #0d0d0d 0%, #2d1b4e 50%, #1a0a2e 100%)'
        },
        cardFields: ['image', 'title', 'genres', 'price'],
        relatedCardFields: ['image', 'title', 'genres'],
        detail: {
            contentRender: 'markdown',
            actionButton: { enabled: true, text: 'Visit Store', linkField: 'store_url' },
            metaLayout: 'grid'
        },
        pages: {
            about: {
                title: 'About GamesInfo',
                intro: 'GamesInfo is your ultimate guide to the gaming world. From AAA blockbusters to indie gems, we provide comprehensive coverage of the games you love and the ones you haven\'t discovered yet.',
                mission: 'Our mission is to help gamers find their next favorite game with detailed information, honest reviews, and up-to-date news from the gaming industry.',
                email: 'contact@gamesinfo.com',
                address: '456 Gaming Boulevard, Los Angeles, CA 90028'
            },
            contact: {
                title: 'Contact Us',
                desc: 'Got a game suggestion or want to collaborate? Drop us a message.',
                email: 'contact@gamesinfo.com',
                address: '456 Gaming Boulevard, Los Angeles, CA 90028'
            },
            privacy: {
                title: 'Privacy Policy',
                brief: `<p>Last updated: January 2026</p>
<p>At GamesInfo, we value your privacy. This Privacy Policy explains how we collect, use, and protect your personal information when you visit our website.</p>
<h2>Information We Collect</h2>
<p>We may collect information about your gaming preferences, browsing history, and device information through cookies and similar technologies.</p>
<h2>How We Use Your Information</h2>
<p>We use this information to provide game recommendations, personalize your experience, and improve our content.</p>
<h2>Contact Us</h2>
<p>If you have questions about this Privacy Policy, please contact us at contact@gamesinfo.com.</p>`,
                full: `<p>Last updated: January 2026</p>
<p>At GamesInfo ("we," "our," or "us"), we are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website.</p>
<h2>1. Information We Collect</h2>
<p><strong>Automatically Collected Information:</strong> When you visit our website, we may automatically collect information about your device, including your IP address, browser type, operating system, and information about your gaming preferences and browsing history.</p>
<p><strong>Cookies and Tracking:</strong> We use cookies and similar tracking technologies to track activity on our website. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.</p>
<h2>2. How We Use Your Information</h2>
<p>We use the information we collect for various purposes, including:</p>
<ul>
<li>To provide and personalize game recommendations</li>
<li>To improve our website and content offerings</li>
<li>To analyze usage patterns and trends</li>
<li>To communicate updates about new games and features</li>
<li>To detect and prevent fraud</li>
</ul>
<h2>3. Third-Party Services</h2>
<p>We may integrate with third-party services such as Steam API to provide game information. These services have their own privacy policies.</p>
<h2>4. Data Security</h2>
<p>We implement appropriate security measures to protect your personal information. However, no method of transmission over the Internet is 100% secure.</p>
<h2>5. Your Rights</h2>
<p>You have the right to access, update, or delete your personal information at any time.</p>
<h2>6. Changes to This Privacy Policy</h2>
<p>We may update our Privacy Policy from time to time. Changes will be posted on this page.</p>
<h2>7. Contact Us</h2>
<p>If you have any questions about this Privacy Policy, please contact us at contact@gamesinfo.com.</p>`
            },
            terms: {
                title: 'Terms of Service',
                brief: `<p>Last updated: January 2026</p>
<p>Welcome to GamesInfo. By accessing our website, you agree to these terms of service.</p>
<h2>Use of Our Website</h2>
<p>You may use our website for lawful purposes only. You agree not to use the website in any way that could damage or impair its operation.</p>
<h2>External Links</h2>
<p>Our website may contain links to external websites, including game stores. We are not responsible for the content or practices of these external sites.</p>
<h2>Contact</h2>
<p>For questions about these Terms, contact us at contact@gamesinfo.com.</p>`,
                full: `<p>Last updated: January 2026</p>
<p>Welcome to GamesInfo ("we," "our," or "us"). By accessing or using our website, you agree to be bound by these Terms of Service.</p>
<h2>1. Acceptance of Terms</h2>
<p>By accessing and using GamesInfo, you accept and agree to be bound by these terms.</p>
<h2>2. Description of Service</h2>
<p>GamesInfo provides game information, reviews, and related content. We reserve the right to modify or discontinue the service at any time.</p>
<h2>3. Use of Our Website</h2>
<p>You agree to use our website only for lawful purposes. Prohibited activities include attempting to exploit game vulnerabilities, sharing cheat-related content, or engaging in any form of harassment.</p>
<h2>4. Intellectual Property</h2>
<p>All content on this website is the property of GamesInfo and its content creators. Game artwork and descriptions may be sourced from official game publishers and are used under fair use for informational purposes.</p>
<h2>5. External Links Disclaimer</h2>
<p>Our website may contain links to external sites including Steam, Epic Games Store, and other game retailers. We are not responsible for the content, privacy policies, or practices of these third-party sites.</p>
<h2>6. Disclaimer</h2>
<p>The game information provided on this website is for general informational purposes. We make no guarantees about the accuracy of pricing, availability, or system requirements.</p>
<h2>7. Limitation of Liability</h2>
<p>In no event shall GamesInfo be liable for any damages arising from your use of the website or reliance on the information provided.</p>
<h2>8. Changes to Terms</h2>
<p>We reserve the right to modify these terms at any time. Continued use of the website constitutes acceptance of the new terms.</p>
<h2>9. Contact</h2>
<p>If you have any questions about these Terms of Service, please contact us at contact@gamesinfo.com.</p>`
            }
        }
    },

    food: {
        id: 'food',
        name: '美食资讯',
        siteTitle: 'FoodHub',
        siteSubtitle: 'Explore Culinary Delights',
        logoText: 'FoodHub',
        fields: [
            { id: 'title', label: 'Title', labelZh: '美食名称', required: true, detailDisplay: 'main-title' },
            { id: 'content', label: 'Content', labelZh: '美食介绍正文', required: true, detailDisplay: 'body' },
            { id: 'image', label: 'Image', labelZh: '美食图片', required: false, detailDisplay: 'hero-image' },
            { id: 'ingredients', label: 'Ingredients', labelZh: '食材清单', required: false, detailDisplay: 'meta' },
            { id: 'cook_time', label: 'Cook Time', labelZh: '烹饪时间', required: false, detailDisplay: 'card+meta' },
            { id: 'difficulty', label: 'Difficulty', labelZh: '难度', required: false, detailDisplay: 'card+meta' },
            { id: 'cuisine', label: 'Cuisine', labelZh: '菜系', required: false, detailDisplay: 'card+meta' },
            { id: 'servings', label: 'Servings', labelZh: '份量', required: false, detailDisplay: 'meta' },
            { id: 'calories', label: 'Calories', labelZh: '卡路里', required: false, detailDisplay: 'meta' },
            { id: 'recipe_url', label: 'Recipe URL', labelZh: '食谱链接', required: false, detailDisplay: 'action-btn' }
        ],
        categories: [
            { name: 'Quick Recipes', icon: '⚡', count: 2 },
            { name: 'Traditional Cuisine', icon: '🏺', count: 6 },
            { name: 'Desserts & Sweets', icon: '🍰', count: 6 },
            { name: 'Healthy Eating', icon: '🥗', count: 6 },
            { name: 'World Cuisine', icon: '🌍', count: 6 }
        ],
        iconPool: ['⚡', '🏺', '🍰', '🥗', '🌍', '🍜', '🍔', '🍕', '🥘', '🍣', '🍩', '🥑', '🧁', '🍳', '🥖', '🍲', '🥞', '🍱', '🍛', '🌮', '🥟', '🫕', '🍵', '🧋'],
        hero: {
            title: 'A World of Flavors Awaits',
            subtitle: 'Discover recipes, cooking tips, and culinary inspiration from every corner of the globe',
            bgStyle: 'linear-gradient(135deg, #1a0a00 0%, #bf360c 50%, #ff6f00 100%)'
        },
        cardFields: ['image', 'title', 'cuisine', 'difficulty', 'cook_time'],
        relatedCardFields: ['image', 'title', 'cuisine'],
        detail: {
            contentRender: 'markdown',
            actionButton: { enabled: true, text: 'View Recipe', linkField: 'recipe_url' },
            metaLayout: 'grid'
        },
        pages: {
            about: {
                title: 'About FoodHub',
                intro: 'FoodHub is your culinary companion, bringing you recipes, cooking tips, and food culture from around the world. Whether you\'re a seasoned chef or a kitchen beginner, we have something delicious for you.',
                mission: 'Our mission is to inspire home cooks everywhere with accessible recipes, expert techniques, and stories that celebrate the art of cooking.',
                email: 'hello@foodhub.com',
                address: '789 Culinary Lane, New York, NY 10012'
            },
            contact: {
                title: 'Contact Us',
                desc: 'Want to share a recipe or have a question? We\'re all ears!',
                email: 'hello@foodhub.com',
                address: '789 Culinary Lane, New York, NY 10012'
            },
            privacy: {
                title: 'Privacy Policy',
                brief: `<p>Last updated: January 2026</p>
<p>At FoodHub, we value your privacy. This Privacy Policy explains how we collect, use, and protect your personal information when you visit our website.</p>
<h2>Information We Collect</h2>
<p>We may collect information about your dietary preferences, search history, and device information.</p>
<h2>How We Use Your Information</h2>
<p>We use this information to provide recipe recommendations and improve your experience.</p>
<h2>Contact Us</h2>
<p>If you have questions about this Privacy Policy, please contact us at hello@foodhub.com.</p>`,
                full: `<p>Last updated: January 2026</p>
<p>At FoodHub ("we," "our," or "us"), we are committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information.</p>
<h2>1. Information We Collect</h2>
<p>We may collect information about your dietary preferences, search history, cooking skill level, and device information through cookies and similar technologies.</p>
<h2>2. How We Use Your Information</h2>
<ul>
<li>To provide personalized recipe recommendations</li>
<li>To improve our content and user experience</li>
<li>To analyze usage patterns and trends</li>
<li>To send you updates about new recipes and features</li>
</ul>
<h2>3. Third-Party Services</h2>
<p>We may use third-party analytics services to monitor and analyze the use of our website.</p>
<h2>4. Data Security</h2>
<p>We implement appropriate security measures to protect your personal information.</p>
<h2>5. Your Rights</h2>
<p>You have the right to access, update, or delete your personal information at any time.</p>
<h2>6. Changes to This Privacy Policy</h2>
<p>We may update our Privacy Policy from time to time. Changes will be posted on this page.</p>
<h2>7. Contact Us</h2>
<p>If you have any questions, please contact us at hello@foodhub.com.</p>`
            },
            terms: {
                title: 'Terms of Service',
                brief: `<p>Last updated: January 2026</p>
<p>Welcome to FoodHub. By accessing our website, you agree to these terms of service.</p>
<h2>Use of Our Website</h2>
<p>You may use our website for lawful purposes only.</p>
<h2>Recipe Content</h2>
<p>Recipes are provided for personal use. Commercial reproduction requires written permission.</p>
<h2>Contact</h2>
<p>For questions about these Terms, contact us at hello@foodhub.com.</p>`,
                full: `<p>Last updated: January 2026</p>
<p>Welcome to FoodHub ("we," "our," or "us"). By accessing or using our website, you agree to be bound by these Terms of Service.</p>
<h2>1. Acceptance of Terms</h2>
<p>By accessing and using FoodHub, you accept and agree to be bound by these terms.</p>
<h2>2. Description of Service</h2>
<p>FoodHub provides recipes, cooking tips, and food-related content. We reserve the right to modify or discontinue the service at any time.</p>
<h2>3. Use of Our Website</h2>
<p>You agree to use our website only for lawful purposes and in accordance with these terms.</p>
<h2>4. Intellectual Property</h2>
<p>All recipes, images, and content on this website are the property of FoodHub and its contributors. Recipes are provided for personal, non-commercial use.</p>
<h2>5. Allergen Disclaimer</h2>
<p>Our recipes may contain or reference common allergens. Users with food allergies or dietary restrictions should verify all ingredients before preparation. FoodHub is not liable for any adverse reactions resulting from the use of our recipes.</p>
<h2>6. Limitation of Liability</h2>
<p>In no event shall FoodHub be liable for any damages arising from your use of the website or reliance on recipe information.</p>
<h2>7. Changes to Terms</h2>
<p>We reserve the right to modify these terms at any time. Continued use constitutes acceptance.</p>
<h2>8. Contact</h2>
<p>For questions, please contact us at hello@foodhub.com.</p>`
            }
        }
    },

    anime: {
        id: 'anime',
        name: '动漫资讯',
        siteTitle: 'AnimeInfo',
        siteSubtitle: 'Your Anime Universe',
        logoText: 'AnimeInfo',
        fields: [
            { id: 'title', label: 'Title', labelZh: '动漫名称', required: true, detailDisplay: 'main-title' },
            { id: 'content', label: 'Content', labelZh: '动漫介绍正文', required: true, detailDisplay: 'body' },
            { id: 'image', label: 'Image', labelZh: '动漫图片', required: false, detailDisplay: 'hero-image' },
            { id: 'studio', label: 'Studio', labelZh: '制作公司', required: false, detailDisplay: 'meta' },
            { id: 'genres', label: 'Genres', labelZh: '动漫类型', required: false, detailDisplay: 'card+meta' },
            { id: 'rating', label: 'Rating', labelZh: '评分', required: false, detailDisplay: 'card+meta' },
            { id: 'episodes', label: 'Episodes', labelZh: '集数', required: false, detailDisplay: 'card+meta' },
            { id: 'season', label: 'Season', labelZh: '季度', required: false, detailDisplay: 'meta' },
            { id: 'air_date', label: 'Air Date', labelZh: '播出日期', required: false, detailDisplay: 'meta' },
            { id: 'official_url', label: 'Official URL', labelZh: '官方链接', required: false, detailDisplay: 'action-btn' }
        ],
        categories: [
            { name: 'Action Anime', icon: '⚔️', count: 2 },
            { name: 'Romance Anime', icon: '💕', count: 6 },
            { name: 'Fantasy Anime', icon: '🧙', count: 6 },
            { name: 'Sci-Fi Anime', icon: '🚀', count: 6 },
            { name: 'Slice of Life Anime', icon: '☀️', count: 6 }
        ],
        iconPool: ['⚔️', '💕', '🧙', '🚀', '☀️', '🌸', '🦊', '🐉', '🎭', '👻', '🌙', '💫', '🎴', '🗡️', '🪽', '🎐', '🐺', '🦄', '🌟', '🪄', '🎪', '🦋', '🗻', '⛩️'],
        hero: {
            title: 'Enter the Anime Universe',
            subtitle: 'Your gateway to the latest anime series, reviews, and community discussions',
            bgStyle: 'linear-gradient(135deg, #1a0a2e 0%, #4a148c 50%, #e91e63 100%)'
        },
        cardFields: ['image', 'title', 'genres', 'rating', 'episodes'],
        relatedCardFields: ['image', 'title', 'genres'],
        detail: {
            contentRender: 'markdown',
            actionButton: { enabled: true, text: 'Official Site', linkField: 'official_url' },
            metaLayout: 'grid'
        },
        pages: {
            about: {
                title: 'About AnimeInfo',
                intro: 'AnimeInfo is your gateway to the anime universe. We bring you the latest series reviews, seasonal guides, and community discussions for anime fans around the world.',
                mission: 'Our mission is to connect anime enthusiasts with the content they love and help them discover new series that will capture their imagination.',
                email: 'contact@animeinfo.com',
                address: '101 Anime Street, Tokyo, Japan 150-0001'
            },
            contact: {
                title: 'Contact Us',
                desc: 'Have an anime recommendation or feedback? Let us know!',
                email: 'contact@animeinfo.com',
                address: '101 Anime Street, Tokyo, Japan 150-0001'
            },
            privacy: {
                title: 'Privacy Policy',
                brief: `<p>Last updated: January 2026</p>
<p>At AnimeInfo, we value your privacy. This Privacy Policy explains how we collect, use, and protect your personal information when you visit our website.</p>
<h2>Information We Collect</h2>
<p>We may collect information about your viewing preferences, ratings, and device information.</p>
<h2>How We Use Your Information</h2>
<p>We use this information to provide personalized anime recommendations and improve your experience.</p>
<h2>Contact Us</h2>
<p>If you have questions about this Privacy Policy, please contact us at contact@animeinfo.com.</p>`,
                full: `<p>Last updated: January 2026</p>
<p>At AnimeInfo ("we," "our," or "us"), we are committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information.</p>
<h2>1. Information We Collect</h2>
<p>We may collect information about your anime viewing preferences, watchlists, rating history, and device information through cookies and similar technologies.</p>
<h2>2. How We Use Your Information</h2>
<ul>
<li>To provide personalized anime recommendations</li>
<li>To improve our content and recommendation algorithm</li>
<li>To analyze viewing trends and patterns</li>
<li>To send you notifications about new anime seasons</li>
</ul>
<h2>3. Third-Party Services</h2>
<p>We may use third-party analytics services and content delivery networks to improve our service.</p>
<h2>4. Data Security</h2>
<p>We implement appropriate security measures to protect your personal information.</p>
<h2>5. Your Rights</h2>
<p>You have the right to access, update, or delete your personal information at any time.</p>
<h2>6. Changes to This Privacy Policy</h2>
<p>We may update our Privacy Policy from time to time. Changes will be posted on this page.</p>
<h2>7. Contact Us</h2>
<p>If you have any questions, please contact us at contact@animeinfo.com.</p>`
            },
            terms: {
                title: 'Terms of Service',
                brief: `<p>Last updated: January 2026</p>
<p>Welcome to AnimeInfo. By accessing our website, you agree to these terms of service.</p>
<h2>Use of Our Website</h2>
<p>You may use our website for lawful purposes only.</p>
<h2>Content Guidelines</h2>
<p>Please be respectful of other users. Spoiler content should be properly marked.</p>
<h2>Contact</h2>
<p>For questions about these Terms, contact us at contact@animeinfo.com.</p>`,
                full: `<p>Last updated: January 2026</p>
<p>Welcome to AnimeInfo ("we," "our," or "us"). By accessing or using our website, you agree to be bound by these Terms of Service.</p>
<h2>1. Acceptance of Terms</h2>
<p>By accessing and using AnimeInfo, you accept and agree to be bound by these terms.</p>
<h2>2. Description of Service</h2>
<p>AnimeInfo provides anime information, reviews, and community features. We reserve the right to modify or discontinue the service at any time.</p>
<h2>3. Use of Our Website</h2>
<p>You agree to use our website only for lawful purposes. Prohibited activities include posting unmarked spoilers, harassment, and unauthorized distribution of copyrighted content.</p>
<h2>4. Spoiler Policy</h2>
<p>Users must clearly mark spoiler content in any reviews, comments, or discussions. AnimeInfo is not responsible for unintended spoiler exposure.</p>
<h2>5. Intellectual Property</h2>
<p>All content on this website is the property of AnimeInfo and its contributors. Anime images and descriptions are used under fair use for informational purposes. All anime titles and related content are the property of their respective owners.</p>
<h2>6. External Links Disclaimer</h2>
<p>Our website may contain links to external streaming services and official anime websites. We are not responsible for the content or practices of these third-party sites.</p>
<h2>7. Limitation of Liability</h2>
<p>In no event shall AnimeInfo be liable for any damages arising from your use of the website.</p>
<h2>8. Changes to Terms</h2>
<p>We reserve the right to modify these terms at any time. Continued use constitutes acceptance.</p>
<h2>9. Contact</h2>
<p>For questions, please contact us at contact@animeinfo.com.</p>`
            }
        }
    }
};

// ========== 内容领域目录 ==========
// 领域元数据同时驱动自动识别、主题选择器和领域专属蓝图推荐。
const DOMAIN_CATALOG = {
    tech: {
        label: '科技资讯', nameEn: 'Technology', icon: '💻', accent: '#2375d8', soft: '#edf5ff',
        description: 'AI、软件、硬件、网络安全与科技产业',
        fieldSignals: ['software', 'hardware', 'device', 'technology', 'tech_stack'],
        keywords: ['artificial intelligence', 'machine learning', 'large language model', 'generative ai', 'semiconductor', 'chip', 'compute', 'data center', 'artificial', 'ai', 'tech', 'software', 'hardware', 'cybersecurity', 'cloud', 'developer', 'technology', '科技', '人工智能', '大模型', '芯片', '半导体', '网络安全', '软件', '硬件'],
        blueprints: ['terminal', 'dashboard', 'neon', 'editorial', 'magazine']
    },
    game: {
        label: '游戏资讯', nameEn: 'Gaming', icon: '🎮', accent: '#6953c6', soft: '#f2efff',
        description: '电子游戏、评测、平台、发行与攻略',
        fieldSignals: ['developer', 'publisher', 'platforms', 'store_url', 'release_date'],
        keywords: ['game', 'gaming', 'steam', 'playstation', 'xbox', 'nintendo', 'rpg', 'gameplay', '游戏', '主机', '攻略', '发行商'],
        blueprints: ['arcade', 'catalog', 'immersive', 'neon', 'brutalist']
    },
    food: {
        label: '美食餐饮', nameEn: 'Food & Cooking', icon: '🍽️', accent: '#d66d22', soft: '#fff4ea',
        description: '食谱、烹饪、餐厅、食材与饮食文化',
        fieldSignals: ['ingredients', 'ingredient', 'cook_time', 'cooking_time', 'prep_time', 'cuisine', 'servings', 'calories', 'recipe_url', 'recipe_name', 'dish_name', 'meal_type', 'food_type', 'restaurant_name', 'menu', 'chef', 'dietary', '食材', '配料', '食谱', '菜谱', '做法', '烹饪', '菜系', '餐厅', '热量'],
        keywords: ['recipe', 'ingredients', 'cooking', 'restaurant', 'cuisine', 'dish', 'meal', 'menu', 'flavor', 'kitchen', 'chef', 'baking', 'dessert', 'pastry', 'brunch', 'culinary', 'mediterranean diet', 'intermittent fasting', 'hydration', 'superfood', 'dietary', 'vegetarian', 'vegan', '食谱', '菜谱', '做法', '烹饪', '食材', '配料', '餐厅', '菜系', '美食', '甜点', '烘焙', '厨房', '营养餐', '减脂餐'],
        blueprints: ['food-recipe', 'food-table', 'food-market', 'food-bistro', 'food-pastry']
    },
    anime: {
        label: '动漫二次元', nameEn: 'Anime', icon: '🌸', accent: '#d34d83', soft: '#fff0f6',
        description: '动画、漫画、番剧、声优与二次元文化',
        fieldSignals: ['studio', 'episodes', 'season', 'air_date', 'official_url'],
        keywords: ['anime', 'manga', 'episode', 'studio', 'season', 'otaku', '动漫', '动画', '漫画', '番剧', '声优'],
        blueprints: ['sakura', 'midnight', 'twilight', 'immersive', 'pastel']
    },
    finance: {
        label: '财经商业', nameEn: 'Finance & Business', icon: '📈', accent: '#13715b', soft: '#e8f5f0',
        description: '金融、投资、市场、公司与商业趋势',
        fieldSignals: ['ticker', 'symbol', 'market', 'stock_price', 'market_cap', 'risk_level'],
        keywords: ['central bank', 'monetary policy', 'federal reserve', 'foreign exchange', 'sovereign rating', 'hedge fund', 'blockchain', 'cryptocurrency', 'bond market', 'interest rate', 'payment', 'finance', 'stock', 'market', 'investment', 'business', 'economy', 'bank', 'revenue', '财经', '金融', '央行', '货币政策', '债券', '汇率', '区块链', '加密资产', '股票', '投资', '商业', '经济'],
        blueprints: ['dashboard', 'terminal', 'magazine', 'editorial', 'luxury']
    },
    health: {
        label: '健康医疗', nameEn: 'Health & Wellness', icon: '🩺', accent: '#17856f', soft: '#e7f7f2',
        description: '健康、医疗、营养、运动与身心管理',
        fieldSignals: ['condition', 'symptoms', 'specialty', 'reviewed_by', 'medical_disclaimer'],
        keywords: ['food and drug administration', 'clinical trial', 'drug approval', 'medical device', 'public health', 'healthcare policy', 'medicare', 'medicaid', 'pharmaceutical', 'biopharma', 'biotech', 'oncology', 'cancer', 'therapy', 'patient', 'vaccine', 'fda', 'health', 'medical', 'doctor', 'wellness', 'nutrition', 'symptom', 'treatment', 'fitness', '健康', '医疗', '医药', '药物', '临床', '患者', '癌症', '肿瘤', '疫苗', '医生', '营养', '疾病', '健身'],
        blueprints: ['editorial', 'bento', 'botanical', 'pastel', 'timeline']
    },
    travel: {
        label: '旅游出行', nameEn: 'Travel', icon: '✈️', accent: '#16748c', soft: '#e8f5f8',
        description: '目的地、酒店、路线、攻略与旅行灵感',
        fieldSignals: ['destination', 'country', 'city', 'best_time', 'budget', 'hotel'],
        keywords: ['travel', 'destination', 'hotel', 'flight', 'tour', 'trip', 'beach', '旅游', '旅行', '酒店', '景点', '目的地', '攻略'],
        blueprints: ['desert', 'immersive', 'deepsea', 'editorial', 'twilight']
    },
    sports: {
        label: '体育赛事', nameEn: 'Sports', icon: '🏆', accent: '#c4472d', soft: '#fff0eb',
        description: '球队、赛事、比分、球员与运动文化',
        fieldSignals: ['team', 'league', 'score', 'player', 'event_date', 'opponent'],
        keywords: ['sports', 'match', 'league', 'team', 'player', 'score', 'football', 'basketball', '体育', '赛事', '球队', '球员', '足球', '篮球'],
        blueprints: ['magazine', 'brutalist', 'dashboard', 'arcade', 'immersive']
    },
    automotive: {
        label: '汽车出行', nameEn: 'Automotive', icon: '🚗', accent: '#465d78', soft: '#edf1f6',
        description: '汽车、车型、评测、新能源与驾驶技术',
        fieldSignals: ['make', 'model', 'mileage', 'engine', 'horsepower', 'vehicle_type'],
        keywords: ['car', 'vehicle', 'automotive', 'engine', 'suv', 'sedan', 'electric vehicle', '汽车', '车型', '发动机', '新能源', '驾驶'],
        blueprints: ['catalog', 'brutalist', 'midnight', 'neon', 'magazine']
    },
    education: {
        label: '教育学习', nameEn: 'Education', icon: '🎓', accent: '#5264b9', soft: '#eef0fb',
        description: '课程、学习方法、校园、考试与职业成长',
        fieldSignals: ['subject', 'level', 'course', 'instructor', 'duration', 'lesson'],
        keywords: ['education', 'course', 'learning', 'student', 'school', 'university', 'lesson', '教育', '课程', '学习', '学生', '学校', '考试'],
        blueprints: ['editorial', 'timeline', 'bento', 'dashboard', 'pastel']
    },
    fashion: {
        label: '时尚美妆', nameEn: 'Fashion & Beauty', icon: '👗', accent: '#a64b73', soft: '#f9edf3',
        description: '穿搭、品牌、美妆、趋势与生活方式',
        fieldSignals: ['brand', 'season', 'material', 'size', 'designer', 'beauty_type'],
        keywords: ['fashion', 'beauty', 'style', 'designer', 'clothing', 'makeup', 'skincare', '时尚', '美妆', '穿搭', '护肤', '品牌'],
        blueprints: ['luxury', 'sakura', 'twilight', 'editorial', 'pastel']
    },
    home: {
        label: '家居生活', nameEn: 'Home & Living', icon: '🏠', accent: '#7b6849', soft: '#f5f1e8',
        description: '家装、室内设计、园艺、收纳与生活灵感',
        fieldSignals: ['room', 'interior_style', 'materials', 'project_cost', 'difficulty'],
        keywords: ['home', 'interior', 'decor', 'garden', 'furniture', 'renovation', '家居', '装修', '室内设计', '园艺', '收纳', '家具'],
        blueprints: ['botanical', 'bento', 'luxury', 'pastel', 'editorial']
    }
};

Object.assign(DOMAIN_CATALOG, {
    general: {
        label: '通用资讯', nameEn: 'General Editorial', icon: '🌐', accent: '#53657a', soft: '#eef2f6',
        description: '跨领域内容、综合资讯与暂未归类的数据', fieldSignals: [], keywords: [],
        blueprints: ['editorial', 'magazine', 'bento', 'timeline', 'dashboard']
    },
    entertainment: {
        label: '娱乐明星', nameEn: 'Entertainment', icon: '🎭', accent: '#a83f78', soft: '#faedf4',
        description: '明星、综艺、电视、演出与流行文化', fieldSignals: ['celebrity', 'show_name', 'network', 'premiere_date'],
        keywords: ['film festival', 'streaming', 'music industry', 'television', 'entertainment', 'celebrity', 'showbiz', 'variety show', 'concert', 'album', 'cannes', '娱乐', '明星', '综艺', '演出', '影视', '电影', '音乐', '娱乐圈'],
        blueprints: ['magazine', 'twilight', 'sakura', 'immersive', 'pastel']
    },
    film: {
        label: '影视电影', nameEn: 'Film & Television', icon: '🎬', accent: '#8b3d35', soft: '#faefed',
        description: '电影、电视剧、影评、演员与流媒体', fieldSignals: ['director', 'cast', 'runtime', 'release_year', 'streaming_url'],
        keywords: ['movie', 'film', 'cinema', 'director', 'actor', 'television series', '电影', '影视', '电视剧', '导演', '演员', '影评'],
        blueprints: ['immersive', 'magazine', 'midnight', 'luxury', 'twilight']
    },
    music: {
        label: '音乐音频', nameEn: 'Music', icon: '🎵', accent: '#7250a8', soft: '#f2edfa',
        description: '音乐、歌手、专辑、演出与音频文化', fieldSignals: ['artist', 'album', 'track', 'record_label', 'release_date'],
        keywords: ['music', 'song', 'album', 'artist', 'concert', 'playlist', '音乐', '歌曲', '歌手', '专辑', '演唱会'],
        blueprints: ['midnight', 'immersive', 'twilight', 'editorial', 'neon']
    },
    books: {
        label: '图书阅读', nameEn: 'Books & Reading', icon: '📚', accent: '#785a3d', soft: '#f5efe8',
        description: '图书、文学、作者、书评与阅读方法', fieldSignals: ['isbn', 'book_author', 'page_count', 'book_publisher'],
        keywords: ['book', 'novel', 'author', 'literature', 'reading', 'book review', '图书', '书评', '文学', '小说', '作者', '阅读'],
        blueprints: ['editorial', 'timeline', 'luxury', 'botanical', 'bento']
    },
    science: {
        label: '科学研究', nameEn: 'Science', icon: '🔬', accent: '#28738a', soft: '#eaf5f7',
        description: '科研、发现、实验、太空与自然科学', fieldSignals: ['doi', 'journal', 'research_field', 'institution', 'study_date'],
        keywords: ['astronomy', 'science', 'research', 'study', 'experiment', 'scientist', 'space', '科学', '科研', '研究', '实验', '太空', '科学家'],
        blueprints: ['editorial', 'terminal', 'dashboard', 'deepsea', 'magazine']
    },
    environment: {
        label: '环境生态', nameEn: 'Environment', icon: '🌍', accent: '#2f7a4f', soft: '#eaf6ee',
        description: '气候、生态、环保、可持续与自然保护', fieldSignals: ['species', 'habitat', 'carbon_impact', 'climate_region'],
        keywords: ['environment', 'climate', 'sustainability', 'wildlife', 'ecology', 'carbon', '环境', '气候', '生态', '环保', '可持续', '野生动物'],
        blueprints: ['botanical', 'deepsea', 'editorial', 'bento', 'desert']
    },
    politics: {
        label: '时政公共', nameEn: 'Politics & Public Affairs', icon: '🏛️', accent: '#405b91', soft: '#edf1f9',
        description: '政策、政府、选举、国际关系与公共事务', fieldSignals: ['country', 'government_body', 'election_date', 'policy_area'],
        keywords: ['politics', 'government', 'election', 'policy', 'parliament', 'president', '时政', '政治', '政府', '选举', '政策', '外交'],
        blueprints: ['magazine', 'editorial', 'dashboard', 'brutalist', 'timeline']
    },
    legal: {
        label: '法律法务', nameEn: 'Legal', icon: '⚖️', accent: '#5c536e', soft: '#f1eef5',
        description: '法律知识、案例、法规、合规与权益', fieldSignals: ['jurisdiction', 'case_number', 'court', 'law_firm', 'effective_date'],
        keywords: ['law', 'legal', 'court', 'regulation', 'compliance', 'attorney', '法律', '法规', '法院', '律师', '合规', '案例'],
        blueprints: ['editorial', 'timeline', 'terminal', 'luxury', 'dashboard']
    },
    realestate: {
        label: '房产地产', nameEn: 'Real Estate', icon: '🏡', accent: '#9a6a35', soft: '#f8f1e7',
        description: '楼市、买房、租赁、商业地产与居住指南', fieldSignals: ['property_type', 'bedrooms', 'bathrooms', 'square_feet', 'listing_price'],
        keywords: ['real estate', 'property', 'housing', 'mortgage', 'rent', 'apartment', '房产', '房地产', '买房', '租房', '楼市', '住宅'],
        blueprints: ['catalog', 'dashboard', 'luxury', 'bento', 'editorial']
    },
    career: {
        label: '职场招聘', nameEn: 'Careers & Jobs', icon: '💼', accent: '#3e6f86', soft: '#eaf3f6',
        description: '招聘、求职、职业发展、办公与人力资源', fieldSignals: ['job_title', 'salary', 'employment_type', 'company_name', 'experience_level'],
        keywords: ['job', 'career', 'hiring', 'resume', 'interview', 'workplace', '招聘', '求职', '职场', '简历', '面试', '职业'],
        blueprints: ['dashboard', 'catalog', 'editorial', 'timeline', 'bento']
    },
    marketing: {
        label: '营销运营', nameEn: 'Marketing', icon: '📣', accent: '#bc5a2d', soft: '#fbf0e9',
        description: '品牌、广告、SEO、社交媒体与增长运营', fieldSignals: ['campaign', 'audience', 'conversion_rate', 'cpc', 'channel'],
        keywords: ['marketing', 'advertising', 'seo', 'campaign', 'brand strategy', 'social media', '营销', '广告', '品牌', '增长', '运营', '社交媒体'],
        blueprints: ['dashboard', 'magazine', 'brutalist', 'neon', 'editorial']
    },
    ecommerce: {
        label: '电商产品', nameEn: 'E-commerce', icon: '🛒', accent: '#25706c', soft: '#e8f5f3',
        description: '商品、购物、选品、零售与消费指南', fieldSignals: ['sku', 'product_price', 'inventory', 'product_url', 'product_brand'],
        keywords: ['ecommerce', 'e-commerce', 'product', 'shopping', 'retail', 'online store', '电商', '商品', '购物', '零售', '选品', '网店'],
        blueprints: ['catalog', 'bento', 'dashboard', 'pastel', 'magazine']
    },
    pets: {
        label: '宠物动物', nameEn: 'Pets', icon: '🐾', accent: '#8a633d', soft: '#f7f0e8',
        description: '猫狗、宠物护理、训练、用品与动物知识', fieldSignals: ['pet_type', 'breed', 'pet_age', 'care_level'],
        keywords: ['pet', 'dog', 'cat', 'puppy', 'kitten', 'veterinary', '宠物', '猫', '狗', '养宠', '兽医', '训练'],
        blueprints: ['bento', 'pastel', 'botanical', 'editorial', 'catalog']
    },
    parenting: {
        label: '母婴育儿', nameEn: 'Parenting', icon: '👶', accent: '#ad657e', soft: '#faeff3',
        description: '孕产、婴幼儿、亲子、家庭教育与成长', fieldSignals: ['child_age', 'age_group', 'parenting_stage', 'development_stage'],
        keywords: ['parenting', 'baby', 'child', 'pregnancy', 'family', 'toddler', '母婴', '育儿', '宝宝', '孕期', '亲子', '儿童'],
        blueprints: ['pastel', 'bento', 'editorial', 'botanical', 'timeline']
    },
    outdoors: {
        label: '户外运动', nameEn: 'Outdoor', icon: '🏕️', accent: '#39704d', soft: '#ebf5ee',
        description: '露营、徒步、登山、骑行与户外装备', fieldSignals: ['trail', 'distance', 'elevation', 'gear', 'difficulty'],
        keywords: ['outdoor', 'hiking', 'camping', 'trail', 'climbing', 'cycling', '户外', '徒步', '露营', '登山', '骑行', '装备'],
        blueprints: ['desert', 'botanical', 'immersive', 'catalog', 'deepsea']
    },
    photography: {
        label: '摄影影像', nameEn: 'Photography', icon: '📸', accent: '#4e647a', soft: '#edf1f5',
        description: '摄影技巧、器材、镜头、后期与视觉创作', fieldSignals: ['camera', 'lens', 'aperture', 'shutter_speed', 'iso'],
        keywords: ['photography', 'camera', 'lens', 'photo', 'photographer', 'lightroom', '摄影', '相机', '镜头', '拍摄', '后期', '照片'],
        blueprints: ['luxury', 'immersive', 'twilight', 'catalog', 'editorial']
    },
    history: {
        label: '历史人文', nameEn: 'History & Humanities', icon: '📜', accent: '#81623d', soft: '#f5efe6',
        description: '历史事件、人物、考古、文明与人文知识', fieldSignals: ['era', 'historical_period', 'event_year', 'historical_figure'],
        keywords: ['lighthouse', 'castle', 'fortress', 'heritage', 'monarchy', 'royal palace', 'historic bridge', 'history', 'historical', 'ancient', 'archaeology', 'civilization', '历史', '古代', '考古', '文明', '城堡', '灯塔', '桥梁', '遗产', '朝代', '历史人物'],
        blueprints: ['timeline', 'editorial', 'luxury', 'desert', 'magazine']
    },
    agriculture: {
        label: '农业园艺', nameEn: 'Agriculture', icon: '🌾', accent: '#647632', soft: '#f1f5e7',
        description: '种植、养殖、农技、农产品与乡村发展', fieldSignals: ['crop', 'farm', 'harvest', 'livestock', 'growing_season'],
        keywords: ['horticulture', 'botany', 'cactus', 'cacti', 'succulent', 'succulents', 'botanical garden', 'plant conservation', 'agriculture', 'farming', 'crop', 'harvest', 'livestock', 'soil', '农业', '园艺', '植物学', '仙人掌', '多肉', '种植', '养殖', '农场', '作物', '土壤'],
        blueprints: ['botanical', 'dashboard', 'editorial', 'bento', 'catalog']
    },
    energy: {
        label: '能源产业', nameEn: 'Energy', icon: '⚡', accent: '#b07b19', soft: '#faf3df',
        description: '电力、石油、光伏、储能与能源转型', fieldSignals: ['energy_type', 'capacity_mw', 'megawatt', 'grid_region', 'plant_type'],
        keywords: ['energy', 'solar', 'wind power', 'oil', 'gas', 'electricity', 'renewable', '能源', '电力', '光伏', '风电', '石油', '储能'],
        blueprints: ['dashboard', 'terminal', 'neon', 'magazine', 'editorial']
    },
    // 专题领域承接自然史、海洋地球科学与文化遗产内容；综合领域仍用于宽主题文章。
    naturalhistory: {
        label: '自然史与生物多样性', nameEn: 'Natural History & Biodiversity', icon: '🐝', accent: '#547755', soft: '#edf5eb',
        description: '物种、演化、栖息地、田野调查与生物多样性保护', fieldSignals: ['scientific_name', 'taxonomy', 'taxonomic_rank', 'species_group', 'conservation_status'],
        keywords: ['natural history', 'biodiversity', 'paleontology', 'paleontological', 'fungal ecology', 'pollinator', 'ornithology', 'migratory bird', 'bat conservation', 'big cat conservation', 'cave biology', 'venomology', 'amber insect', 'entomology', 'herpetology', 'primatology', 'firefly ecology', 'species conservation', '自然史', '生物多样性', '古生物学', '真菌生态', '传粉昆虫', '候鸟迁徙', '蝙蝠保护', '猫科动物保护', '洞穴生物学', '毒液与毒素', '古昆虫学', '昆虫学', '两栖与爬行动物', '灵长类学', '物种保护'],
        blueprints: ['botanical', 'deepsea', 'editorial', 'bento', 'desert']
    },
    marinescience: {
        label: '海洋与水域科学', nameEn: 'Marine & Aquatic Science', icon: '🌊', accent: '#167b91', soft: '#e7f4f7',
        description: '海洋系统、水域生态、海岸修复与水生物种研究', fieldSignals: ['marine_species', 'water_body', 'ocean_basin', 'water_depth', 'salinity'],
        keywords: ['marine science', 'marine biology', 'oceanography', 'deep sea', 'deep-sea', 'coral reef', 'blue carbon', 'plankton', 'seaweed', 'ocean acidification', 'marine archaeology', 'freshwater ecology', 'aquatic ecosystem', 'tidal marsh', 'mangrove restoration', 'marine mammal', 'eel migration', 'microplastic pollution', '海洋科学', '海洋生物', '深海', '珊瑚礁', '蓝碳', '浮游生物', '海藻', '海洋酸化', '海洋考古', '淡水生态', '水域生态', '盐沼', '红树林', '鲸豚', '洄游鱼类', '微塑料'],
        blueprints: ['deepsea', 'dashboard', 'editorial', 'terminal', 'magazine']
    },
    earthscience: {
        label: '地球与大气科学', nameEn: 'Earth & Atmospheric Science', icon: '⛰️', accent: '#a46d37', soft: '#f7f0e7',
        description: '地质过程、古气候、极端天气与地球观测', fieldSignals: ['geologic_period', 'tectonic_setting', 'climate_record', 'weather_event', 'volcano_type'],
        keywords: ['earth science', 'geoscience', 'glaciology', 'ice core', 'tree rings', 'paleoclimate', 'seismology', 'earthquake warning', 'volcanology', 'volcano monitoring', 'geothermal science', 'tornado research', 'severe storm', 'atmospheric electricity', 'space weather', 'meteorite', 'planetary science', 'climate monitoring', '地球科学', '冰川学', '冰芯', '树木年代学', '古气候', '地震学', '地震预警', '火山学', '火山监测', '地热科学', '龙卷风', '强对流', '闪电与大气电学', '空间天气', '陨石学', '行星科学'],
        blueprints: ['desert', 'dashboard', 'editorial', 'terminal', 'timeline']
    },
    culturalheritage: {
        label: '文化遗产与传统工艺', nameEn: 'Cultural Heritage & Craft', icon: '📜', accent: '#8a6040', soft: '#f5efe8',
        description: '文物、手工技艺、历史材料、文献保护与文化记忆', fieldSignals: ['artifact_type', 'craft_technique', 'conservation_method', 'material_period', 'collection'],
        keywords: ['cultural heritage', 'museum collection', 'bookbinding', 'manuscript conservation', 'textile history', 'glassmaking', 'ceramic history', 'cartography history', 'maritime heritage', 'navigation history', 'egyptology', 'numismatics', 'endangered language', 'language preservation', '文化遗产', '博物馆藏品', '书籍装帧', '古籍修复', '纺织史', '玻璃工艺', '陶瓷史', '地图学史', '航海遗产', '航海史', '埃及学', '钱币学', '濒危语言', '语言保护'],
        blueprints: ['timeline', 'luxury', 'editorial', 'magazine', 'botanical']
    }
});

function createDomainTheme(id, profile, options) {
    var siteTitle = options.siteTitle || profile.nameEn.replace(/[^a-z0-9]+/gi, '') + 'Journal';
    var contactEmail = 'contact@' + id + 'journal.com';
    var icons = options.icons || ['📌','🗂️','🔎','📝','💡','📚','🌐','📣','📈','🎯','🧭','✨','⭐','📊','🔖','📰'];
    var extraFields = (options.fields || []).map(function(field) {
        if (!Array.isArray(field)) return field;
        return { id: field[0], label: field[1], labelZh: field[2], required: false, detailDisplay: 'meta' };
    });
    var commonFields = [
        { id: 'title', label: 'Title', labelZh: '文章标题', required: true, detailDisplay: 'main-title' },
        { id: 'content', label: 'Content', labelZh: '文章正文', required: true, detailDisplay: 'body' },
        { id: 'image', label: 'Image', labelZh: '文章头图', required: false, detailDisplay: 'hero-image' },
        { id: 'excerpt', label: 'Excerpt', labelZh: '文章摘要', required: false, detailDisplay: 'excerpt' },
        { id: 'category', label: 'Category', labelZh: '内容分类', required: false, detailDisplay: 'meta' },
        { id: 'author', label: 'Author', labelZh: '作者', required: false, detailDisplay: 'meta' },
        { id: 'published_at', label: 'Published Date', labelZh: '发布日期', required: false, detailDisplay: 'meta' },
        { id: 'source_url', label: 'Source URL', labelZh: '来源链接', required: false, detailDisplay: 'meta' }
    ];
    return {
        id: id,
        name: profile.label,
        siteTitle: siteTitle,
        siteSubtitle: options.subtitle,
        logoText: siteTitle,
        fields: commonFields.concat(extraFields),
        categories: options.categories.map(function(name, index) {
            return { name: name, icon: icons[index % icons.length], count: index === 0 ? 2 : 6 };
        }),
        iconPool: icons,
        hero: { title: options.heroTitle, subtitle: options.subtitle, bgStyle: options.gradient || ('linear-gradient(135deg,#172334,' + profile.accent + ')') },
        cardFields: ['image', 'title', 'excerpt'],
        relatedCardFields: ['image', 'title', 'excerpt'],
        detail: { contentRender: 'markdown', actionButton: { enabled: false, text: 'Learn More', linkField: null }, metaLayout: 'grid' },
        pages: {
            about: { title: 'About ' + siteTitle, intro: siteTitle + ' publishes practical, independently edited coverage across ' + profile.nameEn.toLowerCase() + '.', mission: 'Our mission is to help readers make informed decisions with clear context, useful detail, and transparent sourcing.', email: contactEmail, address: 'Editorial team — online publication' },
            contact: { title: 'Contact Us', desc: 'Send the editorial team a question, correction, or story suggestion.', email: contactEmail, address: 'Editorial team — online publication' },
            privacy: { title: 'Privacy Policy', brief: '<p>Last updated: January 2026</p><p>We explain what limited technical information may be collected and how readers can contact us.</p>', full: '<p>Last updated: January 2026</p><h2>Information we collect</h2><p>We may collect basic device, browser, and usage information needed to operate and improve this publication.</p><h2>How we use information</h2><p>Information is used for security, analytics, and service improvement. We do not sell personal information.</p><h2>Your choices</h2><p>You may control cookies in your browser and contact us about privacy questions.</p><h2>Contact</h2><p>Email ' + contactEmail + '.</p>' },
            terms: { title: 'Terms of Service', brief: '<p>Last updated: January 2026</p><p>This publication is provided for general informational purposes.</p>', full: '<p>Last updated: January 2026</p><h2>Use of this website</h2><p>Use the website lawfully and do not interfere with its operation.</p><h2>Editorial information</h2><p>Content is general information and should not replace advice from a qualified professional.</p><h2>Intellectual property</h2><p>Original text and design remain the property of their respective owners.</p><h2>Contact</h2><p>Email ' + contactEmail + ' with questions.</p>' }
        }
    };
}

var DOMAIN_THEME_OPTIONS = {
    finance: { siteTitle: 'MarketLedger', subtitle: 'Clear context for markets, money, and modern business', heroTitle: 'Understand the Forces Moving Markets', categories: ['Market News', 'Personal Finance', 'Business', 'Investing', 'Economy'], icons: ['📈','💳','💼','💰','🏦','💵','💸','📊','💹','🧾','🏷️','🔔','🧮','🔍','🌐','📰'], gradient: 'linear-gradient(135deg,#0b2b26,#14614f,#d7aa54)', fields: [{ id: 'ticker', label: 'Ticker', labelZh: '证券代码', required: false, detailDisplay: 'meta' }, { id: 'market', label: 'Market', labelZh: '市场', required: false, detailDisplay: 'meta' }, { id: 'risk_level', label: 'Risk Level', labelZh: '风险等级', required: false, detailDisplay: 'meta' }] },
    health: { siteTitle: 'WellnessReview', subtitle: 'Evidence-aware guides for healthier everyday choices', heroTitle: 'Health Information With Context', categories: ['Wellness', 'Nutrition', 'Fitness', 'Conditions', 'Mental Health'], icons: ['🩺','🥗','💪','🧬','🧠','❤️','🏃','💊','🧘','🌿','💧','😴','🏥','🩹','🍎','🧴'], gradient: 'linear-gradient(135deg,#0f4c43,#26977e,#bce9dc)', fields: [{ id: 'condition', label: 'Condition', labelZh: '健康主题', required: false, detailDisplay: 'meta' }, { id: 'reviewed_by', label: 'Reviewed By', labelZh: '专业审核', required: false, detailDisplay: 'meta' }, { id: 'medical_disclaimer', label: 'Medical Disclaimer', labelZh: '医疗免责声明', required: false, detailDisplay: 'body' }] },
    travel: { siteTitle: 'RoamingAtlas', subtitle: 'Field notes, routes, and practical destination guides', heroTitle: 'Go Further, Travel Better', categories: ['Destinations', 'City Guides', 'Hotels', 'Food & Culture', 'Travel Tips'], icons: ['📍','✈️','🗺️','🏨','🍽️','🎒','🚆','🏖️','🧳','📸','🏔️','🛳️','🚗','🌍','🧭','🎟️'], gradient: 'linear-gradient(135deg,#0d5268,#168e9f,#e5a45a)', fields: [{ id: 'destination', label: 'Destination', labelZh: '目的地', required: false, detailDisplay: 'meta' }, { id: 'country', label: 'Country', labelZh: '国家地区', required: false, detailDisplay: 'meta' }, { id: 'best_time', label: 'Best Time', labelZh: '最佳时间', required: false, detailDisplay: 'meta' }, { id: 'budget', label: 'Budget', labelZh: '预算', required: false, detailDisplay: 'meta' }] },
    sports: { siteTitle: 'MatchdayWire', subtitle: 'Scores, stories, and analysis beyond the final whistle', heroTitle: 'Every Match Has a Story', categories: ['Football', 'Basketball', 'Tennis', 'Motorsport', 'More Sports'], icons: ['⚽','🏀','🎾','🏎️','🏆','🏈','⚾','🏐','🥊','🏃','🚴','⛳','🏊','🎯','🥇','📣'], gradient: 'linear-gradient(135deg,#6b1f18,#c13d25,#efaa48)', fields: [{ id: 'team', label: 'Team', labelZh: '球队', required: false, detailDisplay: 'meta' }, { id: 'league', label: 'League', labelZh: '联赛', required: false, detailDisplay: 'meta' }, { id: 'score', label: 'Score', labelZh: '比分', required: false, detailDisplay: 'meta' }, { id: 'event_date', label: 'Event Date', labelZh: '比赛日期', required: false, detailDisplay: 'meta' }] },
    automotive: { siteTitle: 'RoadSpec', subtitle: 'Independent vehicle news, reviews, and technology', heroTitle: 'Machines, Mobility, and the Road Ahead', categories: ['New Cars', 'EVs', 'Reviews', 'Technology', 'Ownership'], icons: ['🚗','⚡','🔍','🧰','🛞','🏁','🔋','🚙','🛠️','⛽','📍','🛣️','🚘','📊','💡','🅿️'], gradient: 'linear-gradient(135deg,#171d26,#40536b,#b1452e)', fields: [{ id: 'make', label: 'Make', labelZh: '品牌', required: false, detailDisplay: 'meta' }, { id: 'model', label: 'Model', labelZh: '车型', required: false, detailDisplay: 'meta' }, { id: 'engine', label: 'Engine', labelZh: '动力系统', required: false, detailDisplay: 'meta' }, { id: 'price', label: 'Price', labelZh: '价格', required: false, detailDisplay: 'meta' }] },
    education: { siteTitle: 'LearningField', subtitle: 'Practical learning guides for students and lifelong learners', heroTitle: 'Build Knowledge That Lasts', categories: ['Study Skills', 'Courses', 'Schools', 'Careers', 'Resources'], icons: ['📚','🎓','🏫','💼','🧭','📝','🔬','🧮','💻','🗂️','🧠','🏆','📖','✏️','🎒','🔎'], gradient: 'linear-gradient(135deg,#27356d,#526bc4,#d8a750)', fields: [{ id: 'subject', label: 'Subject', labelZh: '学科', required: false, detailDisplay: 'meta' }, { id: 'level', label: 'Level', labelZh: '难度等级', required: false, detailDisplay: 'meta' }, { id: 'course', label: 'Course', labelZh: '课程', required: false, detailDisplay: 'meta' }, { id: 'duration', label: 'Duration', labelZh: '学习时长', required: false, detailDisplay: 'meta' }] },
    fashion: { siteTitle: 'FormAndMuse', subtitle: 'Considered fashion, beauty, and personal style', heroTitle: 'Style With a Point of View', categories: ['Fashion', 'Beauty', 'Designers', 'Trends', 'Guides'], icons: ['👗','✨','💄','👜','👠','💍','🕶️','🎨','🧵','🌸','🧥','👒','🛍️','📸','🎀','💅'], gradient: 'linear-gradient(135deg,#5b263f,#ae5278,#e5b7a1)', fields: [{ id: 'brand', label: 'Brand', labelZh: '品牌', required: false, detailDisplay: 'meta' }, { id: 'season', label: 'Season', labelZh: '季节系列', required: false, detailDisplay: 'meta' }, { id: 'material', label: 'Material', labelZh: '材质', required: false, detailDisplay: 'meta' }, { id: 'price', label: 'Price', labelZh: '价格', required: false, detailDisplay: 'meta' }] },
    home: { siteTitle: 'DwellingNotes', subtitle: 'Thoughtful interiors and practical ideas for better living', heroTitle: 'Make Space for Better Living', categories: ['Interiors', 'Renovation', 'Furniture', 'Garden', 'Organization'], icons: ['🏠','🛋️','🛠️','🪑','🌿','🗂️','🖼️','🕯️','🧺','🚪','🪴','🔑','🧹','🛏️','🍽️','📦'], gradient: 'linear-gradient(135deg,#44563f,#7c9270,#d6bd8d)', fields: [{ id: 'room', label: 'Room', labelZh: '空间', required: false, detailDisplay: 'meta' }, { id: 'interior_style', label: 'Interior Style', labelZh: '家居风格', required: false, detailDisplay: 'meta' }, { id: 'materials', label: 'Materials', labelZh: '材料', required: false, detailDisplay: 'meta' }, { id: 'difficulty', label: 'Difficulty', labelZh: '施工难度', required: false, detailDisplay: 'meta' }] },
    general: { siteTitle: 'DailyContext', subtitle: 'Clear, useful coverage across the stories that matter', heroTitle: 'Context for a Changing World', categories: ['Latest', 'Guides', 'Features', 'Opinions', 'Discoveries'], fields: [] },
    entertainment: { siteTitle: 'SpotlightDaily', subtitle: 'People, shows, and stories shaping popular culture', heroTitle: 'Inside the Culture Everyone Is Talking About', categories: ['Celebrities', 'Television', 'Variety Shows', 'Events', 'Culture'], fields: [['celebrity','Celebrity','明星'],['show_name','Show Name','节目名称'],['network','Network','播出平台'],['premiere_date','Premiere Date','首播日期']] },
    film: { siteTitle: 'ScreenLedger', subtitle: 'Reviews, interviews, and stories from film and television', heroTitle: 'Stories Beyond the Screen', categories: ['Movies', 'Television', 'Reviews', 'Streaming', 'Interviews'], fields: [['director','Director','导演'],['cast','Cast','演员阵容'],['runtime','Runtime','片长'],['release_year','Release Year','上映年份']] },
    music: { siteTitle: 'SoundCurrent', subtitle: 'Artists, albums, live shows, and the culture of sound', heroTitle: 'Hear What Is Next', categories: ['New Music', 'Artists', 'Albums', 'Live', 'Culture'], fields: [['artist','Artist','艺人'],['album','Album','专辑'],['track','Track','曲目'],['record_label','Record Label','唱片公司']] },
    books: { siteTitle: 'ReadingRoom', subtitle: 'Books, authors, ideas, and a richer reading life', heroTitle: 'Find Your Next Great Read', categories: ['Fiction', 'Nonfiction', 'Reviews', 'Authors', 'Reading Life'], fields: [['isbn','ISBN','书号'],['book_author','Book Author','图书作者'],['page_count','Page Count','页数'],['book_publisher','Publisher','出版社']] },
    science: { siteTitle: 'ResearchFront', subtitle: 'Discoveries and evidence explained with clarity', heroTitle: 'Explore How the World Works', categories: ['Research', 'Space', 'Biology', 'Physics', 'Innovation'], fields: [['doi','DOI','论文标识'],['journal','Journal','期刊'],['research_field','Research Field','研究领域'],['institution','Institution','研究机构']] },
    environment: { siteTitle: 'LivingPlanet', subtitle: 'Climate, ecology, and practical paths to sustainability', heroTitle: 'Understand Our Changing Planet', categories: ['Climate', 'Wildlife', 'Oceans', 'Sustainability', 'Conservation'], fields: [['species','Species','物种'],['habitat','Habitat','栖息地'],['carbon_impact','Carbon Impact','碳影响'],['climate_region','Climate Region','气候区域']] },
    politics: { siteTitle: 'CivicBrief', subtitle: 'Policy and public affairs with facts and context', heroTitle: 'Public Decisions, Clearly Explained', categories: ['Policy', 'Elections', 'Government', 'World Affairs', 'Analysis'], fields: [['country','Country','国家地区'],['government_body','Government Body','政府机构'],['election_date','Election Date','选举日期'],['policy_area','Policy Area','政策领域']] },
    legal: { siteTitle: 'LawContext', subtitle: 'Accessible legal information, cases, and compliance updates', heroTitle: 'Law Made Clearer', categories: ['Legal Guides', 'Cases', 'Regulation', 'Business Law', 'Rights'], fields: [['jurisdiction','Jurisdiction','司法辖区'],['case_number','Case Number','案件编号'],['court','Court','法院'],['effective_date','Effective Date','生效日期']] },
    realestate: { siteTitle: 'PropertyField', subtitle: 'Housing, property markets, and smarter space decisions', heroTitle: 'Find Context in Every Property', categories: ['Market News', 'Buying', 'Renting', 'Commercial', 'Guides'], fields: [['property_type','Property Type','房产类型'],['bedrooms','Bedrooms','卧室数量'],['square_feet','Area','房屋面积'],['listing_price','Listing Price','挂牌价格']] },
    career: { siteTitle: 'WorkPath', subtitle: 'Jobs, workplace skills, and practical career growth', heroTitle: 'Build a Career With Direction', categories: ['Job Search', 'Skills', 'Leadership', 'Workplace', 'Careers'], fields: [['job_title','Job Title','职位名称'],['salary','Salary','薪资'],['employment_type','Employment Type','用工类型'],['experience_level','Experience Level','经验要求']] },
    marketing: { siteTitle: 'GrowthSignal', subtitle: 'Practical strategy for brands, audiences, and growth', heroTitle: 'Turn Attention Into Sustainable Growth', categories: ['Strategy', 'SEO', 'Content', 'Social Media', 'Analytics'], fields: [['campaign','Campaign','营销活动'],['audience','Audience','目标受众'],['conversion_rate','Conversion Rate','转化率'],['channel','Channel','营销渠道']] },
    ecommerce: { siteTitle: 'RetailScope', subtitle: 'Products, commerce trends, and smarter buying guides', heroTitle: 'Navigate the Modern Marketplace', categories: ['Products', 'Buying Guides', 'Retail', 'Marketplaces', 'Trends'], fields: [['sku','SKU','商品编码'],['product_price','Product Price','商品价格'],['inventory','Inventory','库存'],['product_brand','Brand','商品品牌']] },
    pets: { siteTitle: 'CompanionGuide', subtitle: 'Practical care and a better life with companion animals', heroTitle: 'Help Every Pet Thrive', categories: ['Dogs', 'Cats', 'Care', 'Training', 'Health'], fields: [['pet_type','Pet Type','宠物类型'],['breed','Breed','品种'],['pet_age','Pet Age','宠物年龄'],['care_level','Care Level','护理难度']] },
    parenting: { siteTitle: 'GrowingTogether', subtitle: 'Practical support for parents and growing families', heroTitle: 'Confident Parenting, One Stage at a Time', categories: ['Pregnancy', 'Babies', 'Children', 'Family Life', 'Learning'], fields: [['child_age','Child Age','儿童年龄'],['age_group','Age Group','年龄阶段'],['parenting_stage','Parenting Stage','育儿阶段'],['development_stage','Development Stage','发展阶段']] },
    outdoors: { siteTitle: 'TrailAndField', subtitle: 'Routes, skills, and gear for time outside', heroTitle: 'Step Into the Wider World', categories: ['Hiking', 'Camping', 'Climbing', 'Cycling', 'Gear'], fields: [['trail','Trail','路线'],['distance','Distance','距离'],['elevation','Elevation','海拔'],['gear','Gear','装备']] },
    photography: { siteTitle: 'FrameAndLight', subtitle: 'Technique, equipment, and ideas for visual storytellers', heroTitle: 'See More in Every Frame', categories: ['Techniques', 'Cameras', 'Lenses', 'Editing', 'Inspiration'], fields: [['camera','Camera','相机'],['lens','Lens','镜头'],['aperture','Aperture','光圈'],['shutter_speed','Shutter Speed','快门速度']] },
    history: { siteTitle: 'PastInContext', subtitle: 'People, places, and events that shaped the present', heroTitle: 'Read the Past With New Eyes', categories: ['Ancient World', 'Modern History', 'People', 'Archaeology', 'Culture'], fields: [['era','Era','时代'],['historical_period','Historical Period','历史时期'],['event_year','Event Year','事件年份'],['historical_figure','Historical Figure','历史人物']] },
    agriculture: { siteTitle: 'FieldAndHarvest', subtitle: 'Farming knowledge, rural innovation, and food systems', heroTitle: 'Grow With Better Information', categories: ['Crops', 'Livestock', 'Technology', 'Markets', 'Rural Life'], fields: [['crop','Crop','作物'],['farm','Farm','农场'],['harvest','Harvest','收获季'],['livestock','Livestock','养殖品种']] },
    energy: { siteTitle: 'EnergyCurrent', subtitle: 'Power markets, technology, and the global energy transition', heroTitle: 'Understand the Future of Power', categories: ['Renewables', 'Oil & Gas', 'Electricity', 'Storage', 'Policy'], fields: [['energy_type','Energy Type','能源类型'],['capacity_mw','Capacity','装机容量'],['grid_region','Grid Region','电网区域'],['plant_type','Plant Type','设施类型']] },
    naturalhistory: { siteTitle: 'NaturalAtlas', subtitle: 'Field guides and evidence about life in all its forms', heroTitle: 'Discover Life Across Time and Place', categories: ['Species & Evolution', 'Field Studies', 'Habitats', 'Conservation', 'Natural History'], icons: ['🐝','🌿','🐦','🐟','🦴','🧬','🌱','🔬','📚','🌳','🦉','🦇','🐸','🦎','🍄','🗺️'], gradient: 'linear-gradient(135deg,#233d2c,#537b50,#d7bd78)', fields: [['scientific_name','Scientific Name','学名'],['taxonomic_group','Taxonomic Group','分类群'],['habitat','Habitat','栖息地'],['conservation_status','Conservation Status','保护状态']] },
    marinescience: { siteTitle: 'OceanField', subtitle: 'Research on oceans, waterways, and the life they sustain', heroTitle: 'Read the Signals Beneath the Surface', categories: ['Oceans', 'Marine Life', 'Freshwater', 'Coastal Systems', 'Ocean Research'], icons: ['🌊','🐟','🐚','🚢','💧','🛶','🏝️','🗺️','🧭','🐬','🦭','🦀','⚓','🔬','🌐','📡'], gradient: 'linear-gradient(135deg,#073b51,#087d91,#65c5be)', fields: [['water_body','Water Body','水域'],['ocean_basin','Ocean Basin','海盆'],['water_depth','Water Depth','水深'],['marine_species','Marine Species','海洋物种']] },
    earthscience: { siteTitle: 'TerraSignal', subtitle: 'Field evidence on the forces and records shaping Earth', heroTitle: 'Understand a Planet in Motion', categories: ['Geology', 'Climate Records', 'Atmosphere', 'Natural Hazards', 'Field Research'], icons: ['⛰️','🌋','🌪️','⚡','🛰️','📡','🔬','🔭','🪐','🌌','🧊','☀️','🌬️','📈','🗺️','🌍'], gradient: 'linear-gradient(135deg,#322d35,#8b633f,#d5a664)', fields: [['geologic_period','Geologic Period','地质时期'],['tectonic_setting','Tectonic Setting','构造背景'],['climate_record','Climate Record','气候记录'],['weather_event','Weather Event','天气事件']] },
    culturalheritage: { siteTitle: 'HeritageArchive', subtitle: 'Objects, techniques, and records that connect generations', heroTitle: 'Keep the Stories of Making and Memory', categories: ['Artifacts', 'Traditional Crafts', 'Manuscripts', 'Places & Memory', 'Conservation'], icons: ['📜','🏛️','🗿','🗺️','📚','🧵','🎨','🖼️','📖','🔎','🏺','🧭','🏰','🧱','✍️','🕰️'], gradient: 'linear-gradient(135deg,#382c2a,#8b6448,#c3a574)', fields: [['artifact_type','Artifact Type','文物类型'],['craft_technique','Craft Technique','工艺技法'],['historical_period','Historical Period','历史时期'],['conservation_method','Conservation Method','保护修复方式']] }
};

Object.keys(DOMAIN_THEME_OPTIONS).forEach(function(themeId) {
    THEMES[themeId] = createDomainTheme(themeId, DOMAIN_CATALOG[themeId], DOMAIN_THEME_OPTIONS[themeId]);
});

// ========== 网站 Logo 图标库 ==========
// 图标均为系统 Emoji / Unicode，不依赖外部图标服务，预览和导出后的静态网站都可直接显示。
const LOGO_ICON_GROUPS = [
    { id: 'general', name: '通用', keywords: '品牌 标志 网站 抽象', icons: [
        ['🌐','地球'],['🧭','指南针'],['✨','闪耀'],['⭐','星星'],['🌟','亮星'],['💫','流星'],['🔷','蓝色菱形'],['🔶','橙色菱形'],['🔹','小蓝菱形'],['🔸','小橙菱形'],['💠','花形菱石'],['♾️','无限'],['☀️','太阳'],['🌙','月亮'],['🔥','火焰'],['💎','钻石']
    ]},
    { id: 'technology', name: '科技', keywords: '数码 软件 人工智能 网络 设备', icons: [
        ['💻','笔记本电脑'],['🖥️','台式电脑'],['⌨️','键盘'],['🖱️','鼠标'],['📱','手机'],['🤖','机器人'],['🧠','大脑智能'],['⚙️','齿轮'],['🛠️','工具'],['🔬','显微镜'],['🧪','试管'],['📡','卫星天线'],['🛰️','卫星'],['🔋','电池'],['💡','灯泡创意'],['🧬','基因'],['🛡️','安全盾牌'],['⚡','闪电']
    ]},
    { id: 'games_anime', name: '游戏动漫', keywords: '电竞 二次元 娱乐 角色 像素', icons: [
        ['🎮','游戏手柄'],['🕹️','街机摇杆'],['👾','像素怪兽'],['🎲','骰子'],['🏆','奖杯'],['⚔️','双剑'],['🧙','魔法师'],['🐉','龙'],['🚀','火箭'],['💥','爆炸'],['🎯','靶心'],['🎴','花札'],['🌸','樱花'],['🐱','猫咪'],['🦊','狐狸'],['🍥','鸣门卷'],['🦄','独角兽'],['🧩','拼图']
    ]},
    { id: 'business', name: '商业财经', keywords: '公司 金融 市场 投资 电商', icons: [
        ['📈','上涨趋势'],['📊','柱状图'],['💹','行情上涨'],['💰','钱袋'],['💳','信用卡'],['🏦','银行'],['🧾','账单'],['💸','钞票飞走'],['💼','公文包'],['🏢','办公楼'],['🛒','购物车'],['🛍️','购物袋'],['📦','包裹'],['🏷️','标签'],['🤝','握手'],['⚖️','天平'],['🧮','算盘'],['🧑‍💼','商务人士']
    ]},
    { id: 'media', name: '新闻媒体', keywords: '资讯 内容 编辑 影视 摄影', icons: [
        ['📰','报纸'],['🗞️','卷起的报纸'],['📣','扩音器'],['🎙️','录音麦克风'],['📻','收音机'],['📺','电视'],['🎥','电影摄影机'],['🎬','场记板'],['📷','相机'],['📸','闪光相机'],['✍️','写作'],['📚','书籍'],['🔖','书签'],['📝','备忘录'],['💬','对话'],['🗣️','演讲'],['📢','广播'],['🔎','搜索']
    ]},
    { id: 'health', name: '健康生活', keywords: '医疗 健身 营养 心理 养生', icons: [
        ['❤️','爱心'],['🫀','心脏'],['🩺','听诊器'],['⚕️','医疗标志'],['💊','药丸'],['🩹','创可贴'],['🧘','冥想'],['🏃','跑步'],['🥗','沙拉'],['🍎','苹果'],['🌿','草本'],['🦷','牙齿'],['👁️','眼睛'],['🧴','护理'],['💪','力量'],['🫶','关爱'],['🌱','新生'],['🏥','医院']
    ]},
    { id: 'travel', name: '旅行户外', keywords: '旅游 酒店 路线 自然 探索', icons: [
        ['✈️','飞机'],['🧳','行李箱'],['🗺️','地图'],['🏝️','海岛'],['🏔️','雪山'],['⛺','帐篷'],['🚗','汽车'],['🚆','火车'],['🚲','自行车'],['🥾','登山鞋'],['🌊','海浪'],['🌲','松树'],['🏕️','露营'],['🛶','独木舟'],['🧗','攀岩'],['🏜️','沙漠'],['🌅','日出'],['📍','地点']
    ]},
    { id: 'food', name: '美食餐饮', keywords: '餐厅 菜谱 烹饪 饮品 食材', icons: [
        ['🍽️','餐具'],['🍴','刀叉'],['🥘','炖锅'],['🍳','煎蛋'],['🍜','面条'],['🍣','寿司'],['🍰','蛋糕'],['☕','咖啡'],['🍷','红酒'],['🥖','面包'],['🌶️','辣椒'],['🧑‍🍳','厨师'],['🍔','汉堡'],['🍕','披萨'],['🧁','纸杯蛋糕'],['🍵','热茶'],['🥑','牛油果'],['🍱','便当']
    ]},
    { id: 'education', name: '教育科学', keywords: '学习 学校 研究 知识 课程', icons: [
        ['🎓','学士帽'],['📖','打开的书'],['✏️','铅笔'],['🏫','学校'],['📐','三角尺'],['🔭','望远镜'],['⚗️','蒸馏器'],['🧑‍🔬','科学家'],['🧑‍🏫','教师'],['🔢','数字'],['🧲','磁铁'],['🪐','行星'],['🌌','银河'],['🦠','微生物'],['🏛️','学院'],['📜','卷轴'],['🗿','历史雕像'],['🧑‍🎓','学生']
    ]},
    { id: 'home_nature', name: '家居自然', keywords: '房产 装修 家庭 环境 农业', icons: [
        ['🏠','住宅'],['🏡','花园住宅'],['🛋️','沙发'],['🪴','盆栽'],['🛏️','床'],['🪑','椅子'],['🧰','工具箱'],['🔨','锤子'],['🪟','窗户'],['🕯️','蜡烛'],['🧺','篮子'],['🌾','稻穗'],['🌻','向日葵'],['🌳','大树'],['♻️','循环利用'],['🌍','地球环境'],['🚜','拖拉机'],['🐝','蜜蜂']
    ]},
    { id: 'sports', name: '体育竞技', keywords: '比赛 球队 运动 健身 冠军', icons: [
        ['⚽','足球'],['🏀','篮球'],['🏈','橄榄球'],['⚾','棒球'],['🎾','网球'],['🏐','排球'],['🏓','乒乓球'],['🏸','羽毛球'],['🥊','拳击'],['🏁','方格旗'],['🥇','金牌'],['⛳','高尔夫'],['🏊','游泳'],['🚴','骑行'],['⛹️','篮球运动员'],['🏋️','举重'],['🤸','体操'],['🎿','滑雪']
    ]},
    { id: 'culture', name: '音乐时尚', keywords: '音乐 艺术 设计 美妆 潮流', icons: [
        ['🎵','音符'],['🎶','多个音符'],['🎧','耳机'],['🎤','麦克风'],['🎸','吉他'],['🎹','钢琴'],['🥁','鼓'],['💿','唱片'],['👗','连衣裙'],['👠','高跟鞋'],['💄','口红'],['🌹','玫瑰'],['🎨','调色板'],['🖌️','画笔'],['🎭','戏剧面具'],['🪩','迪斯科球'],['🧵','线轴'],['👑','皇冠']
    ]},
    { id: 'community', name: '社区其他', keywords: '宠物 亲子 职业 公共 社区 能源', icons: [
        ['🐶','小狗'],['🐾','爪印'],['🐈','猫'],['🐦','鸟'],['🐟','鱼'],['👶','宝宝'],['👨‍👩‍👧‍👦','家庭'],['🧸','玩具熊'],['💼','职业'],['📌','图钉'],['🏙️','城市'],['🗳️','投票箱'],['🏛️','公共机构'],['🔑','钥匙'],['🔌','电源'],['☘️','三叶草'],['🕊️','和平鸽'],['🤲','双手']
    ]}
];

// Windows 上部分较新的 Emoji 和医疗符号的彩色变体会显示为方框。所有图标
// 在进入分类/Logo 选择器前统一映射为已验证的替代符号。
const WINDOWS_UNSUPPORTED_EMOJI = ['🫀', '🫶', '🪄', '🫕', '🧋', '🛻', '🪟', '🪩', '🪽', '🪸', '🪼', '⚕️'];
const WINDOWS_EMOJI_REPLACEMENTS = {
    '🫀': '❤️', '🫶': '🤲', '🪄': '✨', '🫕': '🥘', '🧋': '🥤',
    '🛻': '🚙', '🪟': '🏠', '🪩': '💿', '🪽': '🕊️', '🪸': '🐚', '🪼': '🐙', '⚕️': '🩺'
};
function getWindowsSafeEmoji(icon) {
    return WINDOWS_EMOJI_REPLACEMENTS[icon] || icon;
}
LOGO_ICON_GROUPS.forEach(function(group) {
    group.icons.forEach(function(item) {
        item[0] = getWindowsSafeEmoji(item[0]);
    });
});

// 分类图标的手动选择库：保留图标库的原始顺序并去重。它只用于“手动挑选”，
// 不能作为随机组合的来源，避免随机后混入不属于当前领域的图标。
const ALL_CATEGORY_EMOJI_ICONS = [];
LOGO_ICON_GROUPS.forEach(function(group) {
    group.icons.forEach(function(item) {
        if (item[0] && ALL_CATEGORY_EMOJI_ICONS.indexOf(item[0]) === -1) ALL_CATEGORY_EMOJI_ICONS.push(item[0]);
    });
});

const LOGO_ICON_DEFAULTS = {
    tech: '💻', game: '🎮', food: '🍽️', anime: '🌸', finance: '📈', health: '🩺', travel: '🧭', sports: '🏆',
    automotive: '🚗', education: '🎓', fashion: '✨', home: '🏠', general: '🌐', entertainment: '🎭', film: '🎬', music: '🎵',
    books: '📖', science: '🔬', environment: '🌍', politics: '🏛️', legal: '⚖️', realestate: '🏡', career: '💼', marketing: '📣',
    ecommerce: '🛍️', pets: '🐾', parenting: '🧸', outdoors: '🏕️', photography: '📸', history: '📜', agriculture: '🌾', energy: '⚡',
    naturalhistory: '🐝', marinescience: '🌊', earthscience: '🏔️', culturalheritage: '📜'
};

// 领域选择卡片与后续配置使用同一套默认 Emoji，避免入口仍显示旧的抽象符号。
Object.keys(LOGO_ICON_DEFAULTS).forEach(function(themeId) {
    if (DOMAIN_CATALOG[themeId]) DOMAIN_CATALOG[themeId].icon = LOGO_ICON_DEFAULTS[themeId];
});

// ========== 36 个领域的分类 Emoji 图标池 ==========
// 每个领域使用强相关核心图标；海洋科学使用独立图标池，不借用无关通用类别填充。
// 这套池仅驱动分类默认图标和随机的 50 套图标组合；手动选择器另行开放全量图标库。
const DOMAIN_CATEGORY_EMOJI_SEEDS = {
    tech: ['💻','🖥️','📱','🤖','🧠','⚙️','🛰️','📡','🔋','💡'],
    game: ['🎮','🕹️','👾','🎲','🏆','⚔️','🐉','🎯','🚀','🧩'],
    food: ['🍽️','🍳','🥘','🍜','🍣','🍰','☕','🍷','🥖','🧑‍🍳'],
    anime: ['🌸','🎴','🦊','🐉','🍥','🦄','🎭','✨','💫','🚀'],
    finance: ['📈','📊','💹','💰','💳','🏦','💸','🧾','💼','🤝'],
    health: ['🩺','❤️','🫀','⚕️','💊','🩹','🧘','🏃','🥗','🧠'],
    travel: ['✈️','🧳','🗺️','🧭','🏝️','🏔️','🚆','🚗','📍','🌅'],
    sports: ['⚽','🏀','🏈','⚾','🎾','🏐','🏓','🏸','🏆','🥇'],
    automotive: ['🚗','🏎️','🚙','🛻','🚕','🚌','🏁','🛞','🔋','⚡'],
    education: ['🎓','📚','📖','✏️','🏫','📐','🧠','💡','🧑‍🏫','🧑‍🎓'],
    fashion: ['👗','👠','💄','💎','✨','🧵','👑','🌹','🛍️','🎨'],
    home: ['🏠','🏡','🛋️','🪴','🛏️','🪑','🧰','🔨','🪟','🕯️'],
    general: ['📰','🗞️','📣','🔎','🌐','💬','📝','📚','📌','✨'],
    entertainment: ['🎭','📺','🎬','🎤','🎥','🌟','🪩','📸','💬','🔥'],
    film: ['🎬','🎥','📽️','🍿','🎞️','📺','🌟','🎭','📸','🎙️'],
    music: ['🎵','🎶','🎧','🎤','🎸','🎹','🥁','💿','🪩','🎙️'],
    books: ['📚','📖','🔖','✍️','📝','📜','🏛️','💡','🧠','☕'],
    science: ['🔬','🧪','⚗️','🧬','🔭','🪐','🌌','🦠','🧲','💡'],
    environment: ['🌍','🌱','🌿','🌳','♻️','🌊','🐝','🌲','☀️','🌾'],
    politics: ['🏛️','🗳️','📣','🌐','🤝','⚖️','📰','🎙️','🏙️','📜'],
    legal: ['⚖️','🏛️','📜','🔎','🛡️','🤝','💼','🗂️','🧾','🔐'],
    realestate: ['🏡','🏠','🏢','🏙️','🔑','📍','🛋️','🧱','📐','💰'],
    career: ['💼','🧑‍💼','🤝','📈','🎯','🧠','🛠️','🏢','📝','🎓'],
    marketing: ['📣','📈','🎯','💡','📊','🌐','💬','📱','🔥','🤝'],
    ecommerce: ['🛒','🛍️','📦','🏷️','💳','🧾','📱','🚚','⭐','💰'],
    pets: ['🐾','🐶','🐈','🐦','🐟','🩺','❤️','🏠','🧸','🌿'],
    parenting: ['👶','🧸','👨‍👩‍👧‍👦','❤️','🫶','🏠','📚','🍼','🎨','🌱'],
    outdoors: ['🏕️','⛺','🥾','🧭','🏔️','🌲','🧗','🚲','🛶','🌅'],
    photography: ['📸','📷','🎥','🌅','🖼️','💡','👁️','🌈','🏞️','✨'],
    history: ['📜','🏛️','🗿','🏺','⏳','🧭','🗺️','📚','🔎','⚔️'],
    agriculture: ['🌾','🚜','🌱','🌻','🐝','🌿','🌳','🥕','🐄','☀️'],
    energy: ['⚡','🔋','🔌','☀️','🌬️','💡','🏭','🌍','♻️','📊'],
    naturalhistory: ['🐝','🌿','🐦','🐟','🦴','🧬','🌱','🔬','📚','🌳'],
    marinescience: ['🌊','🐟','💧','🏝️','🔬','🐠','🐡','🦈','🐬','🐳','🐋','🦭','🐙','🦑','🦀','🦞','🦐','🦪','🐚','🪸','🪼','🐢','🦦','🐧','🐊','⚓','🚢','🛳️','⛴️','🛥️','🚤','🛶','⛵','🤿','🛟','🧭','🗺️','🧪','🧬','🦠','🔭','📡','🛰️','🌡️','🧊','🌍','♻️','🌿','🌱','☀️','🌬️','🌧️'],
    earthscience: ['⛰️','🌋','🌪️','⚡','🛰️','📡','🔬','🔭','🪐','🧊'],
    culturalheritage: ['📜','🏛️','🗿','🗺️','📚','🧵','🎨','🖼️','📖','🔎']
};

// Extra domain-specific choices extend category defaults without changing brand-logo icon pickers.
const DOMAIN_CATEGORY_EMOJI_EXTENSIONS = {
    tech: ['🖱️','⌨️','🧮','🔐','🧑‍💻','💾','🪫','🧬'],
    game: ['🧙','🧟','🧛','🧚','🧝','🥷','🧞','🧱'],
    food: ['🥑','🥕','🍓','🧀','🍞','🥢','🧂','🫖'],
    anime: ['🎌','👺','👹','🧛','🧙','🦋','🧝','🪭'],
    finance: ['📉','💱','💶','🧮','🏧','🗃️','💵','💴'],
    health: ['🩻','🧑‍⚕️','🧬','🧫','🦴','🦷','🧪','🫁'],
    travel: ['🛣️','🛤️','🚉','🛫','🛬','🚢','🚲','🏨'],
    sports: ['🏅','🥈','🥉','🏉','🏏','🥋','🤸','🏋️'],
    automotive: ['🚘','🚖','🚔','🚜','🚚','🛵','⛽','🧰'],
    education: ['🖊️','✂️','🧑‍💻','📓','🧑‍🔬','🧑‍🎨','📏','🔠'],
    fashion: ['🧥','👖','👚','👟','👜','🕶️','🪡','🧣'],
    home: ['🚪','🪜','🪞','🧺','🧻','🚿','🛁','🧹'],
    general: ['🧭','📺','🧾','✍️','🔔','📬','🪧','🗣️'],
    entertainment: ['🎟️','🎫','🎼','🎻','🎺','🎷','🤹','🎧'],
    film: ['🎟️','🎫','📼','🎤','🎼','🗣️','🧑‍🎤','🎦'],
    music: ['🎼','🪇','🪘','🎺','🎷','🎻','🎚️','🎛️'],
    books: ['📔','📒','📕','📗','📘','📙','📓','🖋️'],
    science: ['🧫','🌡️','🧑‍🔬','⚛️','🧯','🔩','🛰️','🪨'],
    environment: ['🍃','🦋','🦌','🦬','🦜','🦎','🌤️','🪸'],
    politics: ['🗣️','🕊️','🚩','🏳️','📊','🧑‍⚖️','🗂️','🗞️'],
    legal: ['🧑‍⚖️','👩‍⚖️','🔏','📑','📃','🖋️','🗄️','🪪'],
    realestate: ['🏘️','🏚️','🏗️','🏬','🏣','🚧','🪜','🛗'],
    career: ['🧑‍🔧','🧑‍💻','🧑‍🚀','📋','🖇️','💻','📧','🪪'],
    marketing: ['📧','📨','📬','📌','🧲','🗣️','🛎️','📢'],
    ecommerce: ['🏪','🛠️','📲','📫','🧺','🔖','💱','💸'],
    pets: ['🐕‍🦺','🐈‍⬛','🐇','🐹','🐢','🦜','🦎','🪶'],
    parenting: ['🧒','👧','👦','🛝','🛏️','🖍️','🎒','🚼'],
    outdoors: ['🏞️','🌄','🏜️','🪨','🗻','🪵','🧗‍♀️','🪂'],
    photography: ['📽️','📹','📼','🔭','📡','🧑‍🎨','🎞️','🌇'],
    history: ['🧱','🏮','🗡️','🛡️','🏯','🗼','🪔','⚱️'],
    agriculture: ['🌽','🍅','🥬','🐓','🐑','🐖','🌧️','🧑‍🌾'],
    energy: ['🪫','⛽','🛢️','☢️','⚛️','🧯','🔆','🔧'],
    naturalhistory: ['🦕','🦖','🦴','🐚','🪼','🧫','🪺','🪶'],
    marinescience: ['🫧','🪝','🪷','🧂','🪨','🦩','🧜‍♀️','🧜‍♂️'],
    earthscience: ['🪨','🗻','🌦️','🌡️','☄️','💨','🧭','🧬'],
    culturalheritage: ['🏯','⛩️','🪭','🪡','🪕','🧱','🏮','🧿']
};

const DOMAIN_CATEGORY_EMOJI_GROUPS = {
    tech: ['technology','education','media'], game: ['games_anime','technology','sports'], food: ['food','home_nature','health'], anime: ['games_anime','culture','media'],
    finance: ['business','technology','media'], health: ['health','education','sports','food'], travel: ['travel','home_nature','sports'], sports: ['sports','health','travel'],
    automotive: ['travel','technology','business'], education: ['education','technology','media'], fashion: ['culture','business','media'], home: ['home_nature','business','food'],
    general: ['media','general','community'], entertainment: ['media','culture','games_anime'], film: ['media','culture','games_anime'], music: ['culture','media','games_anime'],
    books: ['education','media','culture'], science: ['education','technology','health'], environment: ['home_nature','travel','health'], politics: ['community','media','business'],
    legal: ['business','education','community','media'], realestate: ['home_nature','business','travel'], career: ['business','community','education'], marketing: ['business','media','technology'],
    ecommerce: ['business','media','community'], pets: ['community','home_nature','health'], parenting: ['community','health','education'], outdoors: ['travel','sports','home_nature'],
    photography: ['media','travel','culture'], history: ['education','media','culture'], agriculture: ['home_nature','food','health'], energy: ['technology','home_nature','business'],
    naturalhistory: ['education','home_nature','community','health'], marinescience: [],
    earthscience: ['education','technology','travel','home_nature'], culturalheritage: ['education','culture','media','general']
};

const DOMAIN_CATEGORY_EMOJI_POOLS = {};
Object.keys(DOMAIN_CATALOG).forEach(function(themeId) {
    var pool = [];
    var addIcon = function(icon) {
        icon = getWindowsSafeEmoji(icon);
        if (icon && pool.indexOf(icon) === -1) pool.push(icon);
    };
    (DOMAIN_CATEGORY_EMOJI_SEEDS[themeId] || []).forEach(addIcon);
    (DOMAIN_CATEGORY_EMOJI_EXTENSIONS[themeId] || []).forEach(addIcon);
    (DOMAIN_CATEGORY_EMOJI_GROUPS[themeId] || ['general']).forEach(function(groupId) {
        var group = LOGO_ICON_GROUPS.find(function(item) { return item.id === groupId; });
        if (group) group.icons.forEach(function(item) { addIcon(item[0]); });
    });
    DOMAIN_CATEGORY_EMOJI_POOLS[themeId] = pool.slice(0, 64);
    THEMES[themeId].iconPool = DOMAIN_CATEGORY_EMOJI_POOLS[themeId].slice();
    THEMES[themeId].categories.forEach(function(category, index) {
        category.icon = DOMAIN_CATEGORY_EMOJI_POOLS[themeId][index % DOMAIN_CATEGORY_EMOJI_POOLS[themeId].length];
    });
});

const MARINE_CATEGORY_ICON_RULES = [
    {
        pattern: /\b(fresh\s?water|freshwater|river|lake|wetland|watershed|stream|inland water|groundwater)\b|淡水|河流|湖泊|湿地|流域|溪流|内陆水域|水库|地下水/i,
        icons: ['💧','🐟','🦦','🐢','🐊','🌿','🌱','🧊','🌊']
    },
    {
        pattern: /\b(marine life|sea life|fish(?:eries)?|coral|reef|wildlife|species|marine biology|animal|mammal|shark|whale|dolphin|turtle|seal|plankton|seaweed|kelp|aquaculture)\b|海洋生物|水生生物|物种|渔业|鱼类|鱼|珊瑚|礁|野生动物|鲸|海豚|海龟|鲨|海豹|浮游|海藻|海带|养殖|水母|章鱼|海星/i,
        icons: ['🐟','🐠','🐡','🦈','🐬','🐳','🐋','🦭','🐙','🦑','🦀','🦞','🦐','🦪','🐚','🪸','🪼','🐢']
    },
    {
        pattern: /\b(coast(?:al)?|shore(?:line)?|estuary|mangrove|salt\s?marsh|tidal flat|beach|island)\b|海岸|海滨|海湾|河口|红树林|盐沼|潮滩|潮间带|海滩|海岛/i,
        icons: ['🏝️','🐚','🦀','🌊','⚓','🛶','🛟','🌿','🦪','🚤','⛵']
    },
    {
        pattern: /\b(research|science|exploration|explore|survey|instrument|submersible|submarine|rov|sonar|oceanography|archaeology|expedition|mapping|monitoring)\b|研究|科学|探索|科考|调查|探测|潜水器|深潜|水下机器人|声呐|海洋学|考古|考察|观测|监测/i,
        icons: ['🔬','🧪','🧬','🦠','🔭','📡','🛰️','🌡️','🤿','🚢','🧭','🗺️','🧊']
    },
    {
        pattern: /\b(conservation|ecosystem|ecology|pollution|microplastics?|acidification|climate|blue carbon|water quality|restoration|habitat|sustainability)\b|保护|保育|生态|污染|微塑料|酸化|气候|蓝碳|水质|修复|栖息地|生态系统/i,
        icons: ['♻️','🌿','🌱','💧','🌍','🧊','🔬','🐚','🦠','🌬️','🌧️']
    },
    {
        pattern: /\b(oceans?|seas?|deep[ -]?sea|abyss|ocean basins?|tides?|currents?|pelagic|hydrothermal vents?)\b|深海|海洋|大洋|海盆|海沟|潮汐|洋流|远洋|热液喷口|海底/i,
        icons: ['🌊','⚓','🚢','🛳️','⛴️','🛥️','🧭','🗺️','🧊','💧']
    }
];

/** 优先返回与海洋分类名称匹配的图标；没有匹配词时仅返回海洋领域图标池。 */
function getRecommendedCategoryEmojiOptions(domainId, categoryName) {
    if (domainId !== 'marinescience') return [];
    const normalizedName = String(categoryName == null ? '' : categoryName).normalize('NFKC').toLowerCase();
    const rule = MARINE_CATEGORY_ICON_RULES.find(function(item) { return item.pattern.test(normalizedName); });
    const source = rule ? rule.icons : DOMAIN_CATEGORY_EMOJI_POOLS.marinescience;
    const seen = new Set();
    return source.map(getWindowsSafeEmoji).filter(function(icon) {
        if (!icon || seen.has(icon) || DOMAIN_CATEGORY_EMOJI_POOLS.marinescience.indexOf(icon) === -1) return false;
        seen.add(icon);
        return true;
    });
}

/** 根据分类语义和预设序号稳定选择图标，并避免同一预设内重复。 */
function getDomainRecommendedCategoryIcon(domainId, categoryName, setIndex, usedIcons) {
    const options = getRecommendedCategoryEmojiOptions(domainId, categoryName);
    if (!options.length) return null;
    const variation = Math.max(0, Number.parseInt(setIndex, 10) || 0);
    const start = variation % options.length;
    for (let offset = 0; offset < options.length; offset++) {
        const icon = options[(start + offset) % options.length];
        if (!Array.isArray(usedIcons) || usedIcons.indexOf(icon) === -1) return icon;
    }
    return options[start];
}

/** 为一组分类生成完整的推荐图标，并确保同一预设内没有重复图标。 */
function getDomainRecommendedCategoryIconSet(domainId, categories, setIndex) {
    if (domainId !== 'marinescience') return null;
    const usedIcons = [];
    return (categories || []).map(function(category, index) {
        const categoryName = category && (typeof category === 'object' ? category.name : category);
        const icon = getDomainRecommendedCategoryIcon(domainId, categoryName, setIndex, usedIcons);
        if (icon) usedIcons.push(icon);
        return icon;
    });
}

// ========== 站点品牌标题预设 ==========
// 每个领域最终生成 50 套专属名称；随机组装时会同步替换 Logo、页面标题和正文中的站点称呼。
const BRAND_PRESETS = {
    tech: [
        'TechNews', 'TechPulse', 'FutureStack', 'DigitalScope', 'ByteWire',
        'CircuitDaily', 'NextTech', 'TechBeacon', 'LogicLoop', 'SiliconBrief',
        'InnovateHub', 'DeviceLab', 'CloudCurrent', 'AI Frontier', 'CodeSignal',
        'TechLedger', 'WiredFocus', 'NovaTech', 'DataCurrent', 'QuantumDaily'
    ],
    game: [
        'GameInfo', 'GameVault', 'NextLevel', 'PixelQuest', 'GameScope',
        'PlayForge', 'GameAtlas', 'JoystickHub', 'RespawnDaily', 'LevelUpGuide',
        'QuestLog', 'GamePulse', 'PlayerOne', 'XPCentral', 'BossFight',
        'GameRealm', 'LootLedger', 'ArcadeSignal', 'SavePoint', 'CriticalPlay'
    ],
    food: [
        'FoodHub', 'FlavorTable', 'TasteTrail', 'DailyDish', 'PantryStories',
        'SavoryGuide', 'KitchenAtlas', 'FeastNotes', 'BiteJournal', 'RecipeNest',
        'ForkAndFlame', 'FreshPlate', 'CuisineScope', 'TableCulture', 'DishDiscovery',
        'GourmetPath', 'CookCanvas', 'MealMuse', 'FlavorDaily', 'EpicureHub'
    ],
    anime: [
        'AnimeInfo', 'OtakuVerse', 'AnimeScope', 'AniPulse', 'MangaMuse',
        'SakuraScreen', 'SenpaiDaily', 'NekoStream', 'AnimeAtlas', 'ShonenHub',
        'MechaWorld', 'KawaiiChronicle', 'AniRealm', 'TokyoFrames', 'OtakuSignal',
        'AnimeQuest', 'CosplayCanvas', 'MangaMotion', 'SpiritArc', 'PixelSenpai'
    ]
};

var EXTRA_DOMAIN_BRANDS = {
    finance: ['MarketLedger', 'CapitalBrief', 'TradeSignal', 'FiscalScope', 'ValueCurrent', 'BusinessAtlas'],
    health: ['WellnessReview', 'HealthContext', 'VitalGuide', 'CareJournal', 'BalancedLiving', 'HealthSignal'],
    travel: ['RoamingAtlas', 'RouteAndRest', 'WanderBrief', 'JourneyField', 'LocalPassage', 'TravelLedger'],
    sports: ['MatchdayWire', 'ArenaBrief', 'FinalWhistle', 'SportingScope', 'PlaybookDaily', 'FieldSignal'],
    automotive: ['RoadSpec', 'MotorBrief', 'DriveLedger', 'TorqueJournal', 'AutoScope', 'MobilityWire'],
    education: ['LearningField', 'StudyLedger', 'CourseCompass', 'KnowledgeBrief', 'CampusScope', 'LessonWorks'],
    fashion: ['FormAndMuse', 'StyleLedger', 'ModeJournal', 'AtelierBrief', 'EditAndWear', 'TheLookbook'],
    home: ['DwellingNotes', 'LivingField', 'RoomAndForm', 'HabitatEdit', 'HomeJournal', 'QuietSpaces'],
    naturalhistory: ['NaturalAtlas', 'SpeciesLedger', 'FieldNotesNature', 'BiodiversityAtlas', 'NaturalHistoryReview', 'WildlifeScope'],
    marinescience: ['OceanAtlas', 'BlueCurrent', 'AquaResearch', 'MarineFieldnotes', 'TideLedger', 'SeaScienceReview'],
    earthscience: ['TerraSignal', 'GeologyFieldnotes', 'ClimateRecord', 'AtmosphereReview', 'EarthJournal', 'PlanetaryBrief'],
    culturalheritage: ['HeritageArchive', 'CraftAndMemory', 'MaterialCultureReview', 'LivingHeritage', 'ArtifactJournal', 'ConservationAtlas']
};

Object.keys(EXTRA_DOMAIN_BRANDS).forEach(function(themeId) {
    BRAND_PRESETS[themeId] = EXTRA_DOMAIN_BRANDS[themeId];
});

// 领域专属词库用于补全标题选项。保留人工精选名称在前，再用词根组合扩展到 50 个不重复选项。
const BRAND_NAME_PARTS = {
    tech: [['Quantum','Neural','Byte','Circuit','Cloud','Silicon','Code','Future','Digital','Logic'], ['Wire','Pulse','Lab','Scope','Signal']],
    game: [['Pixel','Quest','Respawn','Level','Loot','Arcade','Player','Boss','Critical','Save'], ['Forge','Vault','Grid','Realm','Hub']],
    food: [['Flavor','Pantry','Kitchen','Recipe','Savory','Feast','Bite','Table','Cuisine','Gourmet'], ['Daily','Journal','Atlas','Nest','Studio']],
    anime: [['Otaku','Sakura','Neko','Shonen','Mecha','Manga','Senpai','Tokyo','Spirit','Kawaii'], ['Signal','Chronicle','Verse','Frames','Realm']],
    finance: [['Capital','Market','Trade','Fiscal','Value','Equity','Wealth','Alpha','Asset','Profit'], ['Brief','Ledger','Scope','Current','Signal']],
    health: [['Vital','Wellness','Care','Balance','Health','Mind','Body','Remedy','Thrive','Wellbeing'], ['Guide','Review','Journal','Context','Signal']],
    travel: [['Roaming','Wander','Journey','Route','Local','Atlas','Passage','Nomad','Horizon','Wayfarer'], ['Guide','Ledger','Field','Notes','Compass']],
    sports: [['Matchday','Arena','Playbook','Field','Sporting','Victory','Final','Score','Athlete','Stadium'], ['Wire','Brief','Daily','Scope','Signal']],
    automotive: [['Road','Motor','Drive','Torque','Auto','Mobility','Gear','Velocity','Garage','Highway'], ['Spec','Brief','Ledger','Journal','Wire']],
    education: [['Learning','Study','Course','Knowledge','Campus','Lesson','Scholar','Academy','Class','Tutor'], ['Field','Ledger','Compass','Brief','Scope']],
    fashion: [['Form','Style','Mode','Atelier','Edit','Look','Runway','Wardrobe','Muse','Vogue'], ['Journal','Ledger','Brief','Studio','Edit']],
    home: [['Dwelling','Living','Room','Habitat','Home','Quiet','Interior','Hearth','Nest','Space'], ['Notes','Field','Form','Edit','Journal']],
    general: [['Daily','Clear','Open','Civic','World','Public','Current','Insight','Context','Common'], ['Brief','Ledger','Journal','Scope','Signal']],
    entertainment: [['Spotlight','Star','Stage','Pop','Culture','Show','Scene','Celebrity','Buzz','Velvet'], ['Daily','Wire','Journal','Scope','Signal']],
    film: [['Screen','Cinema','Frame','Reel','Cut','Lens','Movie','Story','Studio','Premiere'], ['Ledger','Journal','Review','Scope','Signal']],
    music: [['Sound','Audio','Rhythm','Melody','Vinyl','Beat','Tempo','Chorus','Track','Sonic'], ['Current','Journal','Wire','Scope','Signal']],
    books: [['Reading','Book','Page','Chapter','Story','Prose','Literary','Shelf','Novel','Ink'], ['Room','Ledger','Review','Journal','Guide']],
    science: [['Research','Science','Lab','Quantum','Discovery','Evidence','Cosmos','Theory','Atom','Nova'], ['Front','Brief','Journal','Scope','Signal']],
    environment: [['Living','Green','Eco','Climate','Planet','Wild','Earth','Nature','Habitat','Sustain'], ['Journal','Field','Brief','Scope','Signal']],
    politics: [['Civic','Policy','Public','Ballot','Capitol','State','Government','Democracy','Nation','World'], ['Brief','Ledger','Journal','Scope','Signal']],
    legal: [['Law','Legal','Court','Justice','Statute','Case','Rights','Counsel','Juris','Verdict'], ['Context','Brief','Ledger','Journal','Guide']],
    realestate: [['Property','Realty','Home','Estate','Housing','Urban','Dwelling','Key','Square','Address'], ['Field','Ledger','Journal','Scope','Guide']],
    career: [['Work','Career','Talent','Skill','Office','Job','Path','Professional','Leadership','Team'], ['Path','Guide','Journal','Brief','Scope']],
    marketing: [['Growth','Brand','Audience','Market','Campaign','Content','Social','Search','Funnel','Reach'], ['Signal','Lab','Journal','Scope','Brief']],
    ecommerce: [['Retail','Shop','Commerce','Market','Cart','Product','Store','Checkout','Buyer','Merch'], ['Scope','Ledger','Journal','Guide','Signal']],
    pets: [['Companion','Paw','Pet','Tail','Whisker','Animal','Happy','Loyal','Furry','Care'], ['Guide','Journal','Daily','Scope','Signal']],
    parenting: [['Growing','Family','Parent','Little','Kinder','Nurture','Together','Baby','Home','Child'], ['Guide','Journal','Daily','Circle','Notes']],
    outdoors: [['Trail','Summit','Camp','Ridge','Wild','Field','Trek','Peak','Forest','Outdoor'], ['Guide','Journal','Atlas','Scope','Signal']],
    photography: [['Frame','Light','Lens','Shutter','Focus','Capture','Pixel','Exposure','Visual','Camera'], ['Journal','Lab','Guide','Scope','Signal']],
    history: [['Past','Archive','Heritage','Epoch','Chronicle','Ancient','History','Timeline','Era','Legacy'], ['Context','Journal','Ledger','Review','Guide']],
    agriculture: [['Field','Harvest','Farm','Crop','Rural','Grow','Soil','Green','Agri','Acre'], ['Journal','Ledger','Guide','Scope','Signal']],
    energy: [['Energy','Power','Grid','Solar','Volt','Current','Renew','Watt','Clean','Fuel'], ['Current','Journal','Ledger','Scope','Signal']],
    naturalhistory: [['Wildlife','Species','Nature','Field','Bio','Living','Biodiversity','Fauna','Flora','NaturalHistory'], ['Atlas','Journal','Fieldnotes','Review','Scope']],
    marinescience: [['Ocean','Marine','Aqua','Tide','Coastal','Blue','Sea','Water','Current','Pelagic'], ['Atlas','Journal','Research','Scope','Review']],
    earthscience: [['Earth','Terra','Geology','Atmosphere','Climate','Seismic','Weather','Geo','Planet','Field'], ['Signal','Journal','Atlas','Review','Scope']],
    culturalheritage: [['Heritage','Artifact','Craft','Archive','Material','Memory','Conservation','Folio','Culture','Legacy'], ['Journal','Atlas','Review','Scope','Field']]
};

Object.keys(DOMAIN_CATALOG).forEach(function(themeId) {
    var names = (BRAND_PRESETS[themeId] || [THEMES[themeId].siteTitle]).slice();
    var parts = BRAND_NAME_PARTS[themeId];
    var seen = {};
    names = names.filter(function(name) {
        var key = name.toLowerCase().replace(/\s+/g, '');
        if (seen[key]) return false;
        seen[key] = true;
        return true;
    });
    (parts ? parts[0] : [THEMES[themeId].siteTitle]).forEach(function(prefix) {
        (parts ? parts[1] : ['Daily','Review','Journal','Guide','Brief']).forEach(function(suffix) {
            var name = prefix + suffix;
            var key = name.toLowerCase();
            if (!seen[key]) {
                names.push(name);
                seen[key] = true;
            }
        });
    });
    BRAND_PRESETS[themeId] = names.slice(0, 50);
});

Object.keys(BRAND_PRESETS).forEach(function(themeId) {
    BRAND_PRESETS[themeId] = BRAND_PRESETS[themeId].map(function(name, index) {
        return {
            id: themeId + '-brand-' + String(index + 1).padStart(2, '0'),
            name: name,
            siteTitle: name,
            logoText: name
        };
    });
});

// ========== 分类图标组合 ==========
// 每个内容主题生成 50 套可选组合；普通主题轮换领域图标，海洋科学按分类语义取图。
// 步长均可在扩展后的图标池中为每套组合提供至少 8 个不同图标。
const ICON_SET_STEPS = [1, 5, 7, 11, 13, 17, 19, 23];
const ICON_SET_PRESETS = {};

Object.keys(THEMES).forEach(function(themeId) {
    const pool = THEMES[themeId].iconPool;
    ICON_SET_PRESETS[themeId] = Array.from({ length: 50 }, function(_, index) {
        const start = index % pool.length;
        const step = ICON_SET_STEPS[Math.floor(index / pool.length) % ICON_SET_STEPS.length];
        const categories = THEMES[themeId].categories || [];
        const usedMarineIcons = [];
        const icons = Array.from({ length: 8 }, function(__, iconIndex) {
            if (themeId === 'marinescience') {
                const category = categories[iconIndex];
                const categoryName = category && (typeof category === 'object' ? category.name : category);
                const recommended = getDomainRecommendedCategoryIcon(themeId, categoryName, index, usedMarineIcons);
                if (recommended) {
                    usedMarineIcons.push(recommended);
                    return recommended;
                }
            }
            return pool[(start + iconIndex * step) % pool.length];
        });
        return {
            id: themeId + '-icons-' + String(index + 1).padStart(2, '0'),
            name: '图标组合 ' + String(index + 1).padStart(2, '0'),
            icons: icons
        };
    });
});

// ========== 字体预设 ==========
// family 使用本地回退栈，google 使用 Google Fonts CSS2 API 的 family 参数。
// italic 预设优先加载真实斜体字形，网络不可用时仍可安全回退。
const FONT_PRESETS = [
    { id: 'sans-serif', name: '系统无衬线', category: '基础', family: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif' },
    { id: 'serif', name: '系统衬线', category: '基础', family: 'Georgia, "Times New Roman", serif' },
    { id: 'monospace', name: '系统等宽', category: '基础', family: '"Courier New", monospace' },
    { id: 'cursive', name: '系统手写', category: '基础', family: '"Comic Sans MS", "Segoe Script", cursive' },
    { id: 'condensed', name: '系统紧凑', category: '基础', family: '"Arial Narrow", "Helvetica Neue", sans-serif' },
    { id: 'rounded', name: 'Nunito 圆润', category: '圆润', family: '"Nunito", "Varela Round", "Segoe UI", sans-serif', google: 'Nunito:wght@400;600;700' },
    { id: 'modern', name: 'Montserrat 现代', category: '无衬线', family: '"Montserrat", "Segoe UI", sans-serif', google: 'Montserrat:wght@400;500;600;700' },
    { id: 'clean', name: 'Inter 简洁', category: '无衬线', family: '"Inter", "Segoe UI", sans-serif', google: 'Inter:ital,wght@0,400;0,500;0,600;0,700' },
    { id: 'tech', name: 'Rajdhani 科技', category: '展示', family: '"Rajdhani", "Segoe UI", sans-serif', google: 'Rajdhani:wght@400;500;600;700' },
    { id: 'display', name: 'Oswald 展示', category: '展示', family: '"Oswald", "Arial Narrow", sans-serif', google: 'Oswald:wght@400;500;600;700' },
    { id: 'elegant', name: 'Playfair Display 优雅', category: '衬线', family: '"Playfair Display", Georgia, serif', google: 'Playfair+Display:wght@400;600;700' },
    { id: 'literary', name: 'Lora 文艺', category: '衬线', family: '"Lora", Georgia, serif', google: 'Lora:wght@400;500;600;700' },
    { id: 'handwrite', name: 'Caveat 手写', category: '手写', family: '"Caveat", "Comic Sans MS", cursive', google: 'Caveat:wght@400;600;700' },
    { id: 'retro', name: 'Press Start 2P 像素', category: '展示', family: '"Press Start 2P", monospace', google: 'Press+Start+2P' },
    { id: 'inter-italic', name: 'Inter 斜体', category: '斜体', family: '"Inter", "Segoe UI", sans-serif', google: 'Inter:ital,wght@1,400;1,500;1,600;1,700', style: 'italic' },
    { id: 'dm-sans', name: 'DM Sans', category: '无衬线', family: '"DM Sans", "Segoe UI", sans-serif', google: 'DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700' },
    { id: 'dm-sans-italic', name: 'DM Sans 斜体', category: '斜体', family: '"DM Sans", "Segoe UI", sans-serif', google: 'DM+Sans:ital,opsz,wght@1,9..40,400;1,9..40,500;1,9..40,700', style: 'italic' },
    { id: 'plus-jakarta', name: 'Plus Jakarta Sans', category: '无衬线', family: '"Plus Jakarta Sans", "Segoe UI", sans-serif', google: 'Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700' },
    { id: 'plus-jakarta-italic', name: 'Plus Jakarta Sans 斜体', category: '斜体', family: '"Plus Jakarta Sans", "Segoe UI", sans-serif', google: 'Plus+Jakarta+Sans:ital,wght@1,400;1,500;1,600;1,700', style: 'italic' },
    { id: 'space-grotesk', name: 'Space Grotesk', category: '展示', family: '"Space Grotesk", "Segoe UI", sans-serif', google: 'Space+Grotesk:wght@300;400;500;600;700' },
    { id: 'ibm-plex', name: 'IBM Plex Sans', category: '无衬线', family: '"IBM Plex Sans", "Segoe UI", sans-serif', google: 'IBM+Plex+Sans:wght@400;500;600;700' },
    { id: 'ibm-plex-italic', name: 'IBM Plex Sans 斜体', category: '斜体', family: '"IBM Plex Sans", "Segoe UI", sans-serif', google: 'IBM+Plex+Sans:ital,wght@1,400;1,500;1,600;1,700', style: 'italic' },
    { id: 'source-serif', name: 'Source Serif 4', category: '衬线', family: '"Source Serif 4", Georgia, serif', google: 'Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700' },
    { id: 'source-serif-italic', name: 'Source Serif 4 斜体', category: '斜体', family: '"Source Serif 4", Georgia, serif', google: 'Source+Serif+4:ital,opsz,wght@1,8..60,400;1,8..60,600;1,8..60,700', style: 'italic' },
    { id: 'dm-serif', name: 'DM Serif Display', category: '衬线', family: '"DM Serif Display", Georgia, serif', google: 'DM+Serif+Display:ital@0' },
    { id: 'dm-serif-italic', name: 'DM Serif Display 斜体', category: '斜体', family: '"DM Serif Display", Georgia, serif', google: 'DM+Serif+Display:ital@1', style: 'italic' },
    { id: 'merriweather', name: 'Merriweather', category: '衬线', family: '"Merriweather", Georgia, serif', google: 'Merriweather:wght@400;700' },
    { id: 'merriweather-italic', name: 'Merriweather 斜体', category: '斜体', family: '"Merriweather", Georgia, serif', google: 'Merriweather:ital,wght@1,400;1,700', style: 'italic' },
    { id: 'roboto-mono', name: 'Roboto Mono', category: '等宽', family: '"Roboto Mono", "Courier New", monospace', google: 'Roboto+Mono:wght@400;500;700' },
    { id: 'roboto-mono-italic', name: 'Roboto Mono 斜体', category: '斜体', family: '"Roboto Mono", "Courier New", monospace', google: 'Roboto+Mono:ital,wght@1,400;1,500;1,700', style: 'italic' },
    { id: 'jetbrains', name: 'JetBrains Mono', category: '等宽', family: '"JetBrains Mono", "Courier New", monospace', google: 'JetBrains+Mono:wght@400;500;700' },
    { id: 'jetbrains-italic', name: 'JetBrains Mono 斜体', category: '斜体', family: '"JetBrains Mono", "Courier New", monospace', google: 'JetBrains+Mono:ital,wght@1,400;1,500;1,700', style: 'italic' },
    { id: 'barlow-condensed', name: 'Barlow Condensed', category: '紧凑', family: '"Barlow Condensed", "Arial Narrow", sans-serif', google: 'Barlow+Condensed:wght@400;500;600;700' },
    { id: 'barlow-condensed-italic', name: 'Barlow Condensed 斜体', category: '斜体', family: '"Barlow Condensed", "Arial Narrow", sans-serif', google: 'Barlow+Condensed:ital,wght@1,400;1,500;1,600;1,700', style: 'italic' },
    { id: 'rubik', name: 'Rubik', category: '圆润', family: '"Rubik", "Segoe UI", sans-serif', google: 'Rubik:wght@400;500;700' },
    { id: 'nunito-sans', name: 'Nunito Sans', category: '圆润', family: '"Nunito Sans", "Segoe UI", sans-serif', google: 'Nunito+Sans:wght@400;600;700' },
    { id: 'nunito-sans-italic', name: 'Nunito Sans 斜体', category: '斜体', family: '"Nunito Sans", "Segoe UI", sans-serif', google: 'Nunito+Sans:ital,wght@1,400;1,600;1,700', style: 'italic' },
    { id: 'archivo', name: 'Archivo', category: '无衬线', family: '"Archivo", "Segoe UI", sans-serif', google: 'Archivo:wght@400;500;700' },
    { id: 'archivo-italic', name: 'Archivo 斜体', category: '斜体', family: '"Archivo", "Segoe UI", sans-serif', google: 'Archivo:ital,wght@1,400;1,500;1,700', style: 'italic' },
    { id: 'satisfy', name: 'Satisfy 手写', category: '手写', family: '"Satisfy", "Segoe Script", cursive', google: 'Satisfy' },
    { id: 'kalam', name: 'Kalam 手写', category: '手写', family: '"Kalam", "Segoe Script", cursive', google: 'Kalam:wght@300;400;700' }
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
            '--color-primary': '#7b68ee',
            '--color-text': '#e0e0ff',
            '--color-text-secondary': '#a0a0cc',
            '--color-border': 'rgba(123,104,238,0.2)',
            '--color-card-bg': '#0f1640',
            '--color-card-hover': '#1a237e',
            '--navbar-bg': 'rgba(10,14,39,0.9)',
            '--color-primary-rgb': '123,104,238'
        },
        previewBg: 'linear-gradient(135deg, #0a0e27, #1a237e)'
    },
    {
        id: 'cyberpunk',
        name: '赛博朋克',
        vars: {
            '--color-bg': '#0d0d0d',
            '--color-bg-secondary': '#1a1a1a',
            '--color-surface': '#2a0a3a',
            '--color-primary': '#ff00ff',
            '--color-text': '#00ff41',
            '--color-text-secondary': '#00cccc',
            '--color-border': 'rgba(255,0,255,0.3)',
            '--color-card-bg': '#1a1a1a',
            '--color-card-hover': '#2a0a3a',
            '--navbar-bg': 'rgba(13,13,13,0.9)',
            '--color-primary-rgb': '255,0,255'
        },
        previewBg: 'linear-gradient(135deg, #0d0d0d, #2a0a3a)'
    },
    {
        id: 'minimal',
        name: '极简白',
        vars: {
            '--color-bg': '#ffffff',
            '--color-bg-secondary': '#f8f9fa',
            '--color-surface': '#e9ecef',
            '--color-primary': '#333333',
            '--color-text': '#212529',
            '--color-text-secondary': '#6c757d',
            '--color-border': '#dee2e6',
            '--color-card-bg': '#ffffff',
            '--color-card-hover': '#f8f9fa',
            '--navbar-bg': 'rgba(255,255,255,0.95)',
            '--color-primary-rgb': '51,51,51'
        },
        previewBg: '#ffffff'
    },
    {
        id: 'dark',
        name: '暗夜',
        vars: {
            '--color-bg': '#1a1a2e',
            '--color-bg-secondary': '#16213e',
            '--color-surface': '#0f3460',
            '--color-primary': '#e94560',
            '--color-text': '#d4d4d4',
            '--color-text-secondary': '#a0a0a0',
            '--color-border': 'rgba(233,69,96,0.2)',
            '--color-card-bg': '#16213e',
            '--color-card-hover': '#1a1a3e',
            '--navbar-bg': 'rgba(26,26,46,0.9)',
            '--color-primary-rgb': '233,69,96'
        },
        previewBg: 'linear-gradient(135deg, #1a1a2e, #0f3460)'
    },
    {
        id: 'forest',
        name: '森林',
        vars: {
            '--color-bg': '#1b2d1b',
            '--color-bg-secondary': '#243524',
            '--color-surface': '#2e4a2e',
            '--color-primary': '#4caf50',
            '--color-text': '#d4e7d4',
            '--color-text-secondary': '#a0c0a0',
            '--color-border': 'rgba(76,175,80,0.2)',
            '--color-card-bg': '#243524',
            '--color-card-hover': '#2e4a2e',
            '--navbar-bg': 'rgba(27,45,27,0.9)',
            '--color-primary-rgb': '76,175,80'
        },
        previewBg: 'linear-gradient(135deg, #1b2d1b, #2e4a2e)'
    },
    {
        id: 'ocean',
        name: '海洋',
        vars: {
            '--color-bg': '#0c2340',
            '--color-bg-secondary': '#0e2a4a',
            '--color-surface': '#1565c0',
            '--color-primary': '#00bcd4',
            '--color-text': '#b3e5fc',
            '--color-text-secondary': '#81d4fa',
            '--color-border': 'rgba(0,188,212,0.2)',
            '--color-card-bg': '#0e2a4a',
            '--color-card-hover': '#1565c0',
            '--navbar-bg': 'rgba(12,35,64,0.9)',
            '--color-primary-rgb': '0,188,212'
        },
        previewBg: 'linear-gradient(135deg, #0c2340, #1565c0)'
    },
    {
        id: 'retro',
        name: '复古',
        vars: {
            '--color-bg': '#3e2723',
            '--color-bg-secondary': '#4e342e',
            '--color-surface': '#5d4037',
            '--color-primary': '#ff8f00',
            '--color-text': '#efebe9',
            '--color-text-secondary': '#d7ccc8',
            '--color-border': 'rgba(255,143,0,0.2)',
            '--color-card-bg': '#4e342e',
            '--color-card-hover': '#5d4037',
            '--navbar-bg': 'rgba(62,39,35,0.9)',
            '--color-primary-rgb': '255,143,0'
        },
        previewBg: 'linear-gradient(135deg, #3e2723, #5d4037)'
    },
    {
        id: 'gradient',
        name: '渐变流光',
        vars: {
            '--color-bg': '#0f0c29',
            '--color-bg-secondary': '#1a1640',
            '--color-surface': '#302b63',
            '--color-primary': '#6c63ff',
            '--color-text': '#e8e8ff',
            '--color-text-secondary': '#b0b0dd',
            '--color-border': 'rgba(108,99,255,0.2)',
            '--color-card-bg': '#1a1640',
            '--color-card-hover': '#302b63',
            '--navbar-bg': 'rgba(15,12,41,0.9)',
            '--color-primary-rgb': '108,99,255'
        },
        previewBg: 'linear-gradient(135deg, #0f0c29, #302b63)'
    },
    {
        id: 'aurora',
        name: '极光',
        vars: {
            '--color-bg': '#0b0b1a',
            '--color-bg-secondary': '#0f0f24',
            '--color-surface': '#1a1a3e',
            '--color-primary': '#00e5ff',
            '--color-text': '#e0f7fa',
            '--color-text-secondary': '#80deea',
            '--color-border': 'rgba(0,229,255,0.2)',
            '--color-card-bg': '#0f0f24',
            '--color-card-hover': '#1a1a3e',
            '--navbar-bg': 'rgba(11,11,26,0.9)',
            '--color-primary-rgb': '0,229,255'
        },
        previewBg: 'linear-gradient(135deg, #0b0b1a, #00e5ff)'
    },
    {
        id: 'lava',
        name: '熔岩',
        vars: {
            '--color-bg': '#1a0a00',
            '--color-bg-secondary': '#2a1400',
            '--color-surface': '#4a2000',
            '--color-primary': '#ff4500',
            '--color-text': '#ffe0cc',
            '--color-text-secondary': '#ffb080',
            '--color-border': 'rgba(255,69,0,0.2)',
            '--color-card-bg': '#2a1400',
            '--color-card-hover': '#4a2000',
            '--navbar-bg': 'rgba(26,10,0,0.9)',
            '--color-primary-rgb': '255,69,0'
        },
        previewBg: 'linear-gradient(135deg, #1a0a00, #ff4500)'
    },
    {
        id: 'sunset',
        name: '日落',
        vars: {
            '--color-bg': '#2d1b3d',
            '--color-bg-secondary': '#3d2240',
            '--color-surface': '#6a3093',
            '--color-primary': '#ff6b35',
            '--color-text': '#ffe4c9',
            '--color-text-secondary': '#ffc8a0',
            '--color-border': 'rgba(255,107,53,0.2)',
            '--color-card-bg': '#3d2240',
            '--color-card-hover': '#6a3093',
            '--navbar-bg': 'rgba(45,27,61,0.9)',
            '--color-primary-rgb': '255,107,53'
        },
        previewBg: 'linear-gradient(135deg, #2d1b3d, #b44020)'
    },
    {
        id: 'mint',
        name: '薄荷',
        vars: {
            '--color-bg': '#f0faf5',
            '--color-bg-secondary': '#e0f5ec',
            '--color-surface': '#b2dfdb',
            '--color-primary': '#26a69a',
            '--color-text': '#2e7d66',
            '--color-text-secondary': '#607d6e',
            '--color-border': '#b2dfdb',
            '--color-card-bg': '#ffffff',
            '--color-card-hover': '#f0faf5',
            '--navbar-bg': 'rgba(240,250,245,0.95)',
            '--color-primary-rgb': '38,166,154'
        },
        previewBg: '#f0faf5'
    },
    {
        id: 'amber',
        name: '琥珀',
        vars: {
            '--color-bg': '#1a1400',
            '--color-bg-secondary': '#2a2000',
            '--color-surface': '#3d3000',
            '--color-primary': '#ffc107',
            '--color-text': '#fff3cd',
            '--color-text-secondary': '#d4b94e',
            '--color-border': 'rgba(255,193,7,0.25)',
            '--color-card-bg': '#2a2000',
            '--color-card-hover': '#3d3000',
            '--navbar-bg': 'rgba(26,20,0,0.92)',
            '--color-primary-rgb': '255,193,7'
        },
        previewBg: 'linear-gradient(135deg, #1a1400, #3d3000)'
    },
    {
        id: 'lavender',
        name: '薰衣草',
        vars: {
            '--color-bg': '#f5f0ff',
            '--color-bg-secondary': '#ebe0ff',
            '--color-surface': '#d1c4e9',
            '--color-primary': '#7c4dff',
            '--color-text': '#311b72',
            '--color-text-secondary': '#6a4a9e',
            '--color-border': '#d1c4e9',
            '--color-card-bg': '#ffffff',
            '--color-card-hover': '#f5f0ff',
            '--navbar-bg': 'rgba(245,240,255,0.95)',
            '--color-primary-rgb': '124,77,255'
        },
        previewBg: '#f5f0ff'
    },
    {
        id: 'sakura',
        name: '樱花',
        vars: {
            '--color-bg': '#2a1520',
            '--color-bg-secondary': '#3a1e2e',
            '--color-surface': '#5a2e48',
            '--color-primary': '#f48fb1',
            '--color-text': '#fce4ec',
            '--color-text-secondary': '#f8bbd0',
            '--color-border': 'rgba(244,143,177,0.25)',
            '--color-card-bg': '#3a1e2e',
            '--color-card-hover': '#5a2e48',
            '--navbar-bg': 'rgba(42,21,32,0.92)',
            '--color-primary-rgb': '244,143,177'
        },
        previewBg: 'linear-gradient(135deg, #2a1520, #5a2e48)'
    },
    {
        id: 'glacier',
        name: '冰川',
        vars: {
            '--color-bg': '#f0f8ff',
            '--color-bg-secondary': '#e0f0fa',
            '--color-surface': '#bbdefb',
            '--color-primary': '#1565c0',
            '--color-text': '#1a3a5c',
            '--color-text-secondary': '#4a7090',
            '--color-border': '#bbdefb',
            '--color-card-bg': '#ffffff',
            '--color-card-hover': '#f0f8ff',
            '--navbar-bg': 'rgba(240,248,255,0.95)',
            '--color-primary-rgb': '21,101,192'
        },
        previewBg: '#f0f8ff'
    },
    {
        id: 'desert',
        name: '沙漠',
        vars: {
            '--color-bg': '#2c2014',
            '--color-bg-secondary': '#3a2c1e',
            '--color-surface': '#5a4632',
            '--color-primary': '#d4a056',
            '--color-text': '#f5e6cc',
            '--color-text-secondary': '#c8b090',
            '--color-border': 'rgba(212,160,86,0.25)',
            '--color-card-bg': '#3a2c1e',
            '--color-card-hover': '#5a4632',
            '--navbar-bg': 'rgba(44,32,20,0.92)',
            '--color-primary-rgb': '212,160,86'
        },
        previewBg: 'linear-gradient(135deg, #2c2014, #5a4632)'
    },
    {
        id: 'deepsea',
        name: '深海',
        vars: {
            '--color-bg': '#001a1a',
            '--color-bg-secondary': '#002626',
            '--color-surface': '#004040',
            '--color-primary': '#00e5cc',
            '--color-text': '#ccfff5',
            '--color-text-secondary': '#80e0d0',
            '--color-border': 'rgba(0,229,204,0.2)',
            '--color-card-bg': '#002626',
            '--color-card-hover': '#004040',
            '--navbar-bg': 'rgba(0,26,26,0.92)',
            '--color-primary-rgb': '0,229,204'
        },
        previewBg: 'linear-gradient(135deg, #001a1a, #004040)'
    },
    {
        id: 'rosegold',
        name: '玫瑰金',
        vars: {
            '--color-bg': '#1a1218',
            '--color-bg-secondary': '#2a1e24',
            '--color-surface': '#3e2a34',
            '--color-primary': '#e8a0b4',
            '--color-text': '#fde8ef',
            '--color-text-secondary': '#d4a0b8',
            '--color-border': 'rgba(232,160,180,0.25)',
            '--color-card-bg': '#2a1e24',
            '--color-card-hover': '#3e2a34',
            '--navbar-bg': 'rgba(26,18,24,0.92)',
            '--color-primary-rgb': '232,160,180'
        },
        previewBg: 'linear-gradient(135deg, #1a1218, #3e2a34)'
    },
    {
        id: 'carbon',
        name: '碳黑',
        vars: {
            '--color-bg': '#0e0e0e',
            '--color-bg-secondary': '#1a1a1a',
            '--color-surface': '#2a2a2a',
            '--color-primary': '#e0e0e0',
            '--color-text': '#f5f5f5',
            '--color-text-secondary': '#a0a0a0',
            '--color-border': 'rgba(224,224,224,0.15)',
            '--color-card-bg': '#1a1a1a',
            '--color-card-hover': '#2a2a2a',
            '--navbar-bg': 'rgba(14,14,14,0.92)',
            '--color-primary-rgb': '224,224,224'
        },
        previewBg: 'linear-gradient(135deg, #0e0e0e, #2a2a2a)'
    },
    {
        id: 'jade',
        name: '翡翠',
        vars: {
            '--color-bg': '#0a1a14',
            '--color-bg-secondary': '#0e2a1e',
            '--color-surface': '#1a4a34',
            '--color-primary': '#00c853',
            '--color-text': '#c8f7dc',
            '--color-text-secondary': '#80d4a0',
            '--color-border': 'rgba(0,200,83,0.2)',
            '--color-card-bg': '#0e2a1e',
            '--color-card-hover': '#1a4a34',
            '--navbar-bg': 'rgba(10,26,20,0.92)',
            '--color-primary-rgb': '0,200,83'
        },
        previewBg: 'linear-gradient(135deg, #0a1a14, #1a4a34)'
    },
    {
        id: 'twilight',
        name: '黄昏',
        vars: {
            '--color-bg': '#1a1030',
            '--color-bg-secondary': '#251840',
            '--color-surface': '#3a2060',
            '--color-primary': '#7c4dff',
            '--color-text': '#e8daff',
            '--color-text-secondary': '#b0a0cc',
            '--color-border': 'rgba(124,77,255,0.25)',
            '--color-card-bg': '#251840',
            '--color-card-hover': '#3a2060',
            '--navbar-bg': 'rgba(26,16,48,0.92)',
            '--color-primary-rgb': '124,77,255'
        },
        previewBg: 'linear-gradient(135deg, #1a1030, #3a2060)'
    },
    {
        id: 'denim',
        name: '牛仔',
        vars: {
            '--color-bg': '#1a2234',
            '--color-bg-secondary': '#222e44',
            '--color-surface': '#344058',
            '--color-primary': '#6ea8d4',
            '--color-text': '#d4e4f0',
            '--color-text-secondary': '#90b0cc',
            '--color-border': 'rgba(110,168,212,0.25)',
            '--color-card-bg': '#222e44',
            '--color-card-hover': '#344058',
            '--navbar-bg': 'rgba(26,34,52,0.92)',
            '--color-primary-rgb': '110,168,212'
        },
        previewBg: 'linear-gradient(135deg, #1a2234, #344058)'
    },
    {
        id: 'crimson',
        name: '赤金',
        vars: {
            '--color-bg': '#1a0a0a',
            '--color-bg-secondary': '#2a1010',
            '--color-surface': '#4a1818',
            '--color-primary': '#ffd700',
            '--color-text': '#fff5cc',
            '--color-text-secondary': '#d4b860',
            '--color-border': 'rgba(255,215,0,0.25)',
            '--color-card-bg': '#2a1010',
            '--color-card-hover': '#4a1818',
            '--navbar-bg': 'rgba(26,10,10,0.92)',
            '--color-primary-rgb': '255,215,0'
        },
        previewBg: 'linear-gradient(135deg, #1a0a0a, #4a1818)'
    },
    {
        id: 'celadon',
        name: '青瓷',
        vars: {
            '--color-bg': '#f2f6f0',
            '--color-bg-secondary': '#e4ede0',
            '--color-surface': '#b8ccb0',
            '--color-primary': '#5a8a6a',
            '--color-text': '#2e4a36',
            '--color-text-secondary': '#5a7a64',
            '--color-border': '#b8ccb0',
            '--color-card-bg': '#ffffff',
            '--color-card-hover': '#f2f6f0',
            '--navbar-bg': 'rgba(242,246,240,0.95)',
            '--color-primary-rgb': '90,138,106'
        },
        previewBg: '#f2f6f0'
    },
    {
        id: 'minimaldark',
        name: '极简黑',
        vars: {
            '--color-bg': '#121212',
            '--color-bg-secondary': '#1e1e1e',
            '--color-surface': '#2c2c2c',
            '--color-primary': '#bb86fc',
            '--color-text': '#e4e4e4',
            '--color-text-secondary': '#a0a0a0',
            '--color-border': 'rgba(187,134,252,0.2)',
            '--color-card-bg': '#1e1e1e',
            '--color-card-hover': '#2c2c2c',
            '--navbar-bg': 'rgba(18,18,18,0.95)',
            '--color-primary-rgb': '187,134,252'
        },
        previewBg: 'linear-gradient(135deg, #121212, #2c2c2c)'
    },
    {
        id: 'neon',
        name: '霓虹',
        vars: {
            '--color-bg': '#0a0a14',
            '--color-bg-secondary': '#10101e',
            '--color-surface': '#1a1a30',
            '--color-primary': '#39ff14',
            '--color-text': '#e0ffe0',
            '--color-text-secondary': '#80d080',
            '--color-border': 'rgba(57,255,20,0.2)',
            '--color-card-bg': '#10101e',
            '--color-card-hover': '#1a1a30',
            '--navbar-bg': 'rgba(10,10,20,0.92)',
            '--color-primary-rgb': '57,255,20'
        },
        previewBg: 'linear-gradient(135deg, #0a0a14, #1a1a30)'
    }
];

// ========== 扩展配色主题 ==========
// 统一生成完整 CSS 变量，确保新增配色与原有主题具有相同的预览和导出能力。
function hexColorToRgb(hex) {
    var value = String(hex).replace('#', '');
    if (value.length === 3) value = value.split('').map(function(char) { return char + char; }).join('');
    return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

function createColorStylePreset(spec) {
    var primaryRgb = hexColorToRgb(spec.primary);
    var bgRgb = hexColorToRgb(spec.bg);
    var dark = !!spec.dark;
    return {
        id: spec.id,
        name: spec.name,
        vars: {
            '--color-bg': spec.bg,
            '--color-bg-secondary': spec.secondary,
            '--color-surface': spec.surface,
            '--color-primary': spec.primary,
            '--color-text': spec.text || (dark ? '#edf2f7' : '#252b32'),
            '--color-text-secondary': spec.muted || (dark ? '#aab5c4' : '#667181'),
            '--color-border': spec.border || (dark ? 'rgba(255,255,255,0.14)' : 'rgba(36,50,66,0.16)'),
            '--color-card-bg': spec.card || (dark ? spec.secondary : '#ffffff'),
            '--color-card-hover': spec.hover || spec.surface,
            '--navbar-bg': spec.navbar || ('rgba(' + bgRgb.join(',') + ',' + (dark ? '0.94' : '0.92') + ')'),
            '--color-primary-rgb': primaryRgb.join(',')
        },
        previewBg: 'linear-gradient(135deg, ' + spec.bg + ' 0%, ' + spec.surface + ' 68%, ' + spec.primary + ' 145%)'
    };
}

const ADDITIONAL_STYLE_PRESETS = [
    { id: 'porcelain', name: '青花瓷', bg: '#f4f7fb', secondary: '#e7edf5', surface: '#d6e1ef', primary: '#315a8c', text: '#1e2b3b', muted: '#607086', border: '#c5d2e1' },
    { id: 'terracotta', name: '赤陶', bg: '#fbf3ec', secondary: '#f2e3d7', surface: '#e8c8b5', primary: '#b65436', text: '#3d2921', muted: '#7e665c', border: '#dfc2b1' },
    { id: 'sage', name: '雾松', bg: '#f2f5ef', secondary: '#e4eadf', surface: '#cfdbca', primary: '#52735a', text: '#26352a', muted: '#68776b', border: '#c5d0c0' },
    { id: 'plum', name: '紫李', bg: '#f7f0f6', secondary: '#ecdeea', surface: '#ddc4d9', primary: '#7b3e70', text: '#392535', muted: '#786374', border: '#d5bed1' },
    { id: 'coffee', name: '咖啡馆', bg: '#f5efe8', secondary: '#e9ddd1', surface: '#d8c1ad', primary: '#76513f', text: '#342821', muted: '#76665c', border: '#cfbdad' },
    { id: 'nordic', name: '北欧晨雾', bg: '#f3f6f7', secondary: '#e4ebed', surface: '#cddadd', primary: '#4f7780', text: '#253337', muted: '#61747a', border: '#c2d0d4' },
    { id: 'coral', name: '珊瑚湾', bg: '#fff1ed', secondary: '#fbe0d8', surface: '#f3c2b5', primary: '#d95f4b', text: '#422923', muted: '#86685f', border: '#edbbae' },
    { id: 'cobalt', name: '钴蓝', bg: '#eef3ff', secondary: '#dfe8fb', surface: '#c4d5f5', primary: '#2757c7', text: '#1d2b4c', muted: '#63708d', border: '#b8c9ec' },
    { id: 'moss', name: '苔藓', bg: '#eef2e8', secondary: '#e0e7d7', surface: '#c8d3b9', primary: '#536b3d', text: '#293322', muted: '#68745d', border: '#bdc9af' },
    { id: 'ivorygold', name: '象牙金', bg: '#fbf8f0', secondary: '#f1ead8', surface: '#e3d4ae', primary: '#a47a2f', text: '#393126', muted: '#7a6d55', border: '#dbcda9' },
    { id: 'navy', name: '海军蓝', bg: '#0b1728', secondary: '#11233a', surface: '#193657', primary: '#4b8fe2', dark: true, card: '#10243c', hover: '#183552' },
    { id: 'peach', name: '蜜桃', bg: '#fff3ee', secondary: '#fbe4dc', surface: '#f3cbbf', primary: '#cf715d', text: '#422c27', muted: '#876b62', border: '#edc4b8' },
    { id: 'rainteal', name: '雨后青', bg: '#edf5f3', secondary: '#dcebe7', surface: '#bfdbd4', primary: '#347b73', text: '#203936', muted: '#607a76', border: '#b5d1cb' },
    { id: 'wine', name: '酒窖', bg: '#211014', secondary: '#31171e', surface: '#4a202c', primary: '#c05b72', dark: true, card: '#2b151b', hover: '#44202a' },
    { id: 'slate', name: '石板', bg: '#151b24', secondary: '#202936', surface: '#2d3949', primary: '#839bb8', dark: true, card: '#1d2632', hover: '#2b3746' },
    { id: 'tealnight', name: '青碧夜', bg: '#082626', secondary: '#0e3634', surface: '#13504b', primary: '#35c1ae', dark: true, card: '#0c302f', hover: '#124944' },
    { id: 'dune', name: '沙丘', bg: '#f8f1e5', secondary: '#eee1cd', surface: '#dfc8a5', primary: '#9f6d35', text: '#3b3023', muted: '#7b6a54', border: '#d7c09e' },
    { id: 'orchid', name: '兰屿', bg: '#f6effa', secondary: '#eadcf2', surface: '#d9c1e6', primary: '#8b59a9', text: '#37273f', muted: '#78657f', border: '#d0b8de' },
    { id: 'nightflight', name: '夜航', bg: '#10182d', secondary: '#172440', surface: '#21365d', primary: '#728be8', dark: true, card: '#142039', hover: '#203255' },
    { id: 'copper', name: '铜锈', bg: '#14231f', secondary: '#1c332d', surface: '#29483e', primary: '#c08762', dark: true, card: '#192d28', hover: '#27433a' },
    { id: 'newsprint', name: '纸墨', bg: '#f5f2e9', secondary: '#ebe6d9', surface: '#dcd4c4', primary: '#37342f', text: '#24221e', muted: '#6d685f', border: '#cec7b8' },
    { id: 'citrus', name: '柑橘', bg: '#fff7e8', secondary: '#fbedcc', surface: '#f5d89a', primary: '#d87912', text: '#3d3020', muted: '#806e54', border: '#edcf92' },
    { id: 'azure', name: '天青', bg: '#eef8fd', secondary: '#dceff7', surface: '#bfe0ee', primary: '#287fa3', text: '#20343e', muted: '#607985', border: '#b5d7e5' },
    { id: 'burgundy', name: '勃艮第', bg: '#f8eff1', secondary: '#eedde1', surface: '#dfc1c9', primary: '#8d3249', text: '#3d252c', muted: '#7e6269', border: '#d7b8c0' }
].map(createColorStylePreset);

ADDITIONAL_STYLE_PRESETS.forEach(function(preset) { STYLE_PRESETS.push(preset); });

// ========== 页面模板蓝图 ==========
// 视觉预设只负责配色；模板蓝图同时改变首页、详情页和组件的结构组合。
// 这样“随机组装”抽到的是不同的页面方案，而不是只换一层颜色。
const TEMPLATE_ARCHETYPES = [
    {
        id: 'editorial', name: '编辑杂志', icon: '📰', description: '大标题、留白和双栏阅读节奏',
        structure: { heroEnabled: true, homeLayout: 'featured', cardColumns: '2', cardViewMode: 'card', navbarLayout: 'left', footerStyle: 'detailed', metaLayout: 'list', detailLayout: 'single' },
        style: { selectedStyle: 'minimal', fontStyle: 'literary', navbarStyle: 'transparent', logoStyle: 'text', cardBorder: 'thin', cardRadius: '0', cardHover: 'float', categoryTitleStyle: 'left-accent', categoryTitleAlign: 'left', cardImageHeight: '220px', contentMaxWidth: '1000px', heroStyle: 'minimal', detailImgStyle: 'centered', btnStyle: 'outline', btnSize: 'large' }
    },
    {
        id: 'magazine', name: '新闻杂志', icon: '🗞️', description: '强对比头图与多栏目首页',
        structure: { heroEnabled: true, homeLayout: 'featured', cardColumns: 'auto', cardViewMode: 'card', navbarLayout: 'normal', footerStyle: 'detailed', metaLayout: 'grid', detailLayout: 'sidebar' },
        style: { selectedStyle: 'sunset', fontStyle: 'display', navbarStyle: 'dark-fixed', logoStyle: 'boxed', cardBorder: 'shadow', cardRadius: '8px', cardHover: 'slide-up', categoryTitleStyle: 'gradient', categoryTitleAlign: 'left', cardImageHeight: '220px', contentMaxWidth: '1200px', heroStyle: 'gradient', detailImgStyle: 'banner', btnStyle: 'gradient', btnSize: 'medium' }
    },
    {
        id: 'catalog', name: '产品目录', icon: '🗂️', description: '高密度网格，适合游戏和条目型数据',
        structure: { heroEnabled: false, homeLayout: 'compact', cardColumns: '4', cardViewMode: 'card', navbarLayout: 'centered', footerStyle: 'simple', metaLayout: 'tags', detailLayout: 'sidebar' },
        style: { selectedStyle: 'glacier', fontStyle: 'clean', navbarStyle: 'glass-sticky', logoStyle: 'text-icon', cardBorder: 'thin', cardRadius: '4px', cardHover: 'scale', categoryTitleStyle: 'single', categoryTitleAlign: 'center', cardImageHeight: '150px', contentMaxWidth: '1400px', heroStyle: 'solid', detailImgStyle: 'fullwidth', btnStyle: 'pill', btnSize: 'small' }
    },
    {
        id: 'immersive', name: '沉浸故事', icon: '🌌', description: '宽幅视觉、侧栏详情和强氛围色',
        structure: { heroEnabled: true, homeLayout: 'split', cardColumns: 'auto', cardViewMode: 'card', navbarLayout: 'normal', footerStyle: 'simple', metaLayout: 'grid', detailLayout: 'sidebar' },
        style: { selectedStyle: 'aurora', fontStyle: 'modern', navbarStyle: 'transparent', logoStyle: 'gradient-text', cardBorder: 'none', cardRadius: '16px', cardHover: 'glow', categoryTitleStyle: 'none', categoryTitleAlign: 'left', cardImageHeight: '260px', contentMaxWidth: '1200px', heroStyle: 'gradient', detailImgStyle: 'banner', btnStyle: 'gradient', btnSize: 'large' }
    },
    {
        id: 'arcade', name: '街机复古', icon: '🕹️', description: '像素字体、虚线边框和高反馈交互',
        structure: { heroEnabled: true, homeLayout: 'featured', cardColumns: '3', cardViewMode: 'card', navbarLayout: 'normal', footerStyle: 'simple', metaLayout: 'tags', detailLayout: 'single' },
        style: { selectedStyle: 'retro', fontStyle: 'retro', navbarStyle: 'bottom-fixed', logoStyle: 'text-icon', cardBorder: 'dashed', cardRadius: '0', cardHover: 'bounce', categoryTitleStyle: 'double', categoryTitleAlign: 'center', cardImageHeight: '180px', contentMaxWidth: '1100px', heroStyle: 'pattern', detailImgStyle: 'centered', btnStyle: '3d', btnSize: 'medium' }
    },
    {
        id: 'bento', name: '轻量卡片', icon: '🧩', description: '圆角卡片、柔和背景和轻交互',
        structure: { heroEnabled: true, homeLayout: 'masonry', cardColumns: '3', cardViewMode: 'card', navbarLayout: 'centered', footerStyle: 'simple', metaLayout: 'grid', detailLayout: 'single' },
        style: { selectedStyle: 'mint', fontStyle: 'rounded', navbarStyle: 'glass-sticky', logoStyle: 'text-icon', cardBorder: 'rounded', cardRadius: '16px', cardHover: 'scale', categoryTitleStyle: 'none', categoryTitleAlign: 'center', cardImageHeight: '180px', contentMaxWidth: '1100px', heroStyle: 'solid', detailImgStyle: 'fullwidth', btnStyle: 'rounded', btnSize: 'medium' }
    },
    {
        id: 'food-recipe', name: '食谱厨房', icon: '🥘', description: '双列菜谱卡片、食材感配色与清晰的制作步骤入口',
        structure: { heroEnabled: false, homeLayout: 'featured', cardColumns: '2', cardViewMode: 'card', navbarLayout: 'normal', footerStyle: 'detailed', metaLayout: 'list', detailLayout: 'single' },
        style: { selectedStyle: 'jade', fontStyle: 'rounded', navbarStyle: 'glass-sticky', logoStyle: 'text-icon', cardBorder: 'rounded', cardRadius: '16px', cardHover: 'image-zoom', categoryTitleStyle: 'left-accent', categoryTitleAlign: 'left', cardImageHeight: '240px', contentMaxWidth: '1080px', heroStyle: 'solid', detailImgStyle: 'centered', btnStyle: 'rounded', btnSize: 'medium' }
    },
    {
        id: 'food-table', name: '餐桌灵感', icon: '🍽️', description: '留白餐桌版式、两列专题与强调标题的阅读节奏',
        structure: { heroEnabled: false, homeLayout: 'split', cardColumns: '2', cardViewMode: 'card', navbarLayout: 'normal', footerStyle: 'detailed', metaLayout: 'grid', detailLayout: 'single' },
        style: { selectedStyle: 'minimal', fontStyle: 'literary', navbarStyle: 'transparent', logoStyle: 'text', cardBorder: 'thin', cardRadius: '12px', cardHover: 'title-underline', categoryTitleStyle: 'single', categoryTitleAlign: 'left', cardImageHeight: '220px', contentMaxWidth: '1020px', heroStyle: 'minimal', detailImgStyle: 'centered', btnStyle: 'outline', btnSize: 'medium' }
    },
    {
        id: 'food-market', name: '时令食材', icon: '🥬', description: '多图食材陈列、轻快网格与季节性内容编排',
        structure: { heroEnabled: false, homeLayout: 'masonry', cardColumns: '3', cardViewMode: 'card', navbarLayout: 'normal', footerStyle: 'simple', metaLayout: 'tags', detailLayout: 'single' },
        style: { selectedStyle: 'mint', fontStyle: 'clean', navbarStyle: 'glass-sticky', logoStyle: 'text-icon', cardBorder: 'rounded', cardRadius: '18px', cardHover: 'color-reveal', categoryTitleStyle: 'none', categoryTitleAlign: 'center', cardImageHeight: '210px', contentMaxWidth: '1120px', heroStyle: 'solid', detailImgStyle: 'fullwidth', btnStyle: 'pill', btnSize: 'medium' }
    },
    {
        id: 'food-bistro', name: '餐馆指南', icon: '🍷', description: '餐馆与菜品导向的紧凑卡片，适合榜单、探店与推荐内容',
        structure: { heroEnabled: false, homeLayout: 'compact', cardColumns: '3', cardViewMode: 'card', navbarLayout: 'normal', footerStyle: 'simple', metaLayout: 'list', detailLayout: 'sidebar' },
        style: { selectedStyle: 'rosegold', fontStyle: 'modern', navbarStyle: 'normal', logoStyle: 'boxed', cardBorder: 'shadow', cardRadius: '14px', cardHover: 'accent-line', categoryTitleStyle: 'left-accent', categoryTitleAlign: 'left', cardImageHeight: '190px', contentMaxWidth: '1180px', heroStyle: 'minimal', detailImgStyle: 'banner', btnStyle: 'solid', btnSize: 'small' }
    },
    {
        id: 'food-pastry', name: '甜点画册', icon: '🧁', description: '大图甜点画册、柔和色彩与适合烘焙专题的视觉层次',
        structure: { heroEnabled: false, homeLayout: 'featured', cardColumns: '2', cardViewMode: 'card', navbarLayout: 'normal', footerStyle: 'detailed', metaLayout: 'grid', detailLayout: 'single' },
        style: { selectedStyle: 'amber', fontStyle: 'elegant', navbarStyle: 'transparent', logoStyle: 'gradient-text', cardBorder: 'none', cardRadius: '20px', cardHover: 'image-zoom', categoryTitleStyle: 'gradient', categoryTitleAlign: 'center', cardImageHeight: '250px', contentMaxWidth: '1060px', heroStyle: 'gradient', detailImgStyle: 'centered', btnStyle: 'rounded', btnSize: 'large' }
    },
    {
        id: 'terminal', name: '终端数据', icon: '⌨️', description: '等宽字体、紧凑布局和数据优先层级',
        structure: { heroEnabled: false, homeLayout: 'compact', cardColumns: '2', cardViewMode: 'list', navbarLayout: 'left', footerStyle: 'simple', metaLayout: 'list', detailLayout: 'single' },
        style: { selectedStyle: 'carbon', fontStyle: 'monospace', navbarStyle: 'normal', logoStyle: 'boxed', cardBorder: 'thin', cardRadius: '0', cardHover: 'border-glow', categoryTitleStyle: 'dotted', categoryTitleAlign: 'left', cardImageHeight: '120px', contentMaxWidth: '1000px', heroStyle: 'minimal', detailImgStyle: 'float-left', btnStyle: 'ghost', btnSize: 'small' }
    },
    {
        id: 'luxury', name: '精品画册', icon: '✨', description: '优雅衬线字体与低密度视觉节奏',
        structure: { heroEnabled: true, homeLayout: 'split', cardColumns: '2', cardViewMode: 'card', navbarLayout: 'centered', footerStyle: 'detailed', metaLayout: 'grid', detailLayout: 'single' },
        style: { selectedStyle: 'rosegold', fontStyle: 'elegant', navbarStyle: 'transparent', logoStyle: 'gradient-text', cardBorder: 'none', cardRadius: '12px', cardHover: 'float', categoryTitleStyle: 'single', categoryTitleAlign: 'center', cardImageHeight: '220px', contentMaxWidth: '1000px', heroStyle: 'minimal', detailImgStyle: 'centered', btnStyle: 'outline', btnSize: 'large' }
    },
    {
        id: 'timeline', name: '时间线', icon: '⏳', description: '单列叙事、紧凑信息和连续阅读节奏',
        structure: { heroEnabled: false, homeLayout: 'compact', cardColumns: '1', cardViewMode: 'list', navbarLayout: 'left', footerStyle: 'detailed', metaLayout: 'list', detailLayout: 'single' },
        style: { selectedStyle: 'denim', fontStyle: 'literary', navbarStyle: 'normal', logoStyle: 'text', cardBorder: 'thin', cardRadius: '0', cardHover: 'slide-up', categoryTitleStyle: 'dotted', categoryTitleAlign: 'left', cardImageHeight: '150px', contentMaxWidth: '900px', heroStyle: 'minimal', detailImgStyle: 'float-left', btnStyle: 'outline', btnSize: 'small' }
    },
    {
        id: 'dashboard', name: '数据看板', icon: '📊', description: '高密度四列网格与快速扫描层级',
        structure: { heroEnabled: false, homeLayout: 'compact', cardColumns: '4', cardViewMode: 'card', navbarLayout: 'normal', footerStyle: 'simple', metaLayout: 'grid', detailLayout: 'sidebar' },
        style: { selectedStyle: 'celadon', fontStyle: 'clean', navbarStyle: 'glass-sticky', logoStyle: 'boxed', cardBorder: 'rounded', cardRadius: '8px', cardHover: 'scale', categoryTitleStyle: 'left-accent', categoryTitleAlign: 'left', cardImageHeight: '120px', contentMaxWidth: '1400px', heroStyle: 'solid', detailImgStyle: 'fullwidth', btnStyle: 'solid', btnSize: 'small' }
    },
    {
        id: 'brutalist', name: '粗野主义', icon: '🧱', description: '厚边框、强对比和直接的视觉语气',
        structure: { heroEnabled: true, homeLayout: 'featured', cardColumns: '3', cardViewMode: 'card', navbarLayout: 'left', footerStyle: 'simple', metaLayout: 'tags', detailLayout: 'sidebar' },
        style: { selectedStyle: 'carbon', fontStyle: 'display', navbarStyle: 'normal', logoStyle: 'boxed', cardBorder: 'thick', cardRadius: '0', cardHover: 'none', categoryTitleStyle: 'double', categoryTitleAlign: 'left', cardImageHeight: '180px', contentMaxWidth: '1200px', heroStyle: 'solid', detailImgStyle: 'banner', btnStyle: 'square', btnSize: 'large' }
    },
    {
        id: 'botanical', name: '植物标本', icon: '🌿', description: '自然色调、圆润卡片和松弛留白',
        structure: { heroEnabled: true, homeLayout: 'masonry', cardColumns: '3', cardViewMode: 'card', navbarLayout: 'centered', footerStyle: 'detailed', metaLayout: 'tags', detailLayout: 'single' },
        style: { selectedStyle: 'jade', fontStyle: 'rounded', navbarStyle: 'glass-sticky', logoStyle: 'text-icon', cardBorder: 'rounded', cardRadius: '16px', cardHover: 'float', categoryTitleStyle: 'none', categoryTitleAlign: 'center', cardImageHeight: '220px', contentMaxWidth: '1100px', heroStyle: 'gradient', detailImgStyle: 'centered', btnStyle: 'rounded', btnSize: 'medium' }
    },
    {
        id: 'midnight', name: '午夜电台', icon: '🌙', description: '深色背景、荧光强调和沉浸阅读',
        structure: { heroEnabled: false, homeLayout: 'split', cardColumns: '2', cardViewMode: 'card', navbarLayout: 'normal', footerStyle: 'simple', metaLayout: 'list', detailLayout: 'sidebar' },
        style: { selectedStyle: 'minimaldark', fontStyle: 'tech', navbarStyle: 'dark-fixed', logoStyle: 'gradient-text', cardBorder: 'none', cardRadius: '8px', cardHover: 'glow', categoryTitleStyle: 'left-accent', categoryTitleAlign: 'left', cardImageHeight: '180px', contentMaxWidth: '1000px', heroStyle: 'minimal', detailImgStyle: 'banner', btnStyle: 'ghost', btnSize: 'medium' }
    },
    {
        id: 'pastel', name: '柔和彩纸', icon: '🌈', description: '明亮背景、柔和色块和友好卡片',
        structure: { heroEnabled: true, homeLayout: 'featured', cardColumns: '3', cardViewMode: 'card', navbarLayout: 'centered', footerStyle: 'simple', metaLayout: 'grid', detailLayout: 'single' },
        style: { selectedStyle: 'lavender', fontStyle: 'rounded', navbarStyle: 'transparent', logoStyle: 'text-icon', cardBorder: 'rounded', cardRadius: '24px', cardHover: 'scale', categoryTitleStyle: 'gradient', categoryTitleAlign: 'center', cardImageHeight: '180px', contentMaxWidth: '1100px', heroStyle: 'solid', detailImgStyle: 'fullwidth', btnStyle: 'pill', btnSize: 'medium' }
    },
    {
        id: 'sakura', name: '樱花日记', icon: '🌸', description: '粉色氛围、优雅排版和轻量边界',
        structure: { heroEnabled: true, homeLayout: 'masonry', cardColumns: '3', cardViewMode: 'card', navbarLayout: 'normal', footerStyle: 'detailed', metaLayout: 'grid', detailLayout: 'single' },
        style: { selectedStyle: 'sakura', fontStyle: 'elegant', navbarStyle: 'transparent', logoStyle: 'gradient-text', cardBorder: 'thin', cardRadius: '12px', cardHover: 'float', categoryTitleStyle: 'single', categoryTitleAlign: 'center', cardImageHeight: '220px', contentMaxWidth: '1100px', heroStyle: 'gradient', detailImgStyle: 'centered', btnStyle: 'outline', btnSize: 'large' }
    },
    {
        id: 'desert', name: '沙漠旅志', icon: '🏜️', description: '暖色大图、宽幅内容和旅行感',
        structure: { heroEnabled: false, homeLayout: 'split', cardColumns: '2', cardViewMode: 'card', navbarLayout: 'left', footerStyle: 'detailed', metaLayout: 'list', detailLayout: 'sidebar' },
        style: { selectedStyle: 'desert', fontStyle: 'literary', navbarStyle: 'normal', logoStyle: 'boxed', cardBorder: 'shadow', cardRadius: '4px', cardHover: 'slide-up', categoryTitleStyle: 'left-accent', categoryTitleAlign: 'left', cardImageHeight: '220px', contentMaxWidth: '1200px', heroStyle: 'solid', detailImgStyle: 'banner', btnStyle: 'solid', btnSize: 'medium' }
    },
    {
        id: 'deepsea', name: '深海档案', icon: '🐋', description: '蓝绿色调、宽卡片和探索式阅读',
        structure: { heroEnabled: true, homeLayout: 'featured', cardColumns: '2', cardViewMode: 'card', navbarLayout: 'centered', footerStyle: 'simple', metaLayout: 'tags', detailLayout: 'sidebar' },
        style: { selectedStyle: 'deepsea', fontStyle: 'modern', navbarStyle: 'glass-sticky', logoStyle: 'text-icon', cardBorder: 'thin', cardRadius: '12px', cardHover: 'glow', categoryTitleStyle: 'gradient', categoryTitleAlign: 'left', cardImageHeight: '260px', contentMaxWidth: '1200px', heroStyle: 'gradient', detailImgStyle: 'banner', btnStyle: 'gradient', btnSize: 'large' }
    },
    {
        id: 'crimson', name: '赤金典藏', icon: '👑', description: '红金配色、庄重标题和收藏感',
        structure: { heroEnabled: true, homeLayout: 'split', cardColumns: '2', cardViewMode: 'card', navbarLayout: 'centered', footerStyle: 'detailed', metaLayout: 'grid', detailLayout: 'single' },
        style: { selectedStyle: 'crimson', fontStyle: 'display', navbarStyle: 'dark-fixed', logoStyle: 'boxed', cardBorder: 'double', cardRadius: '4px', cardHover: 'float', categoryTitleStyle: 'double', categoryTitleAlign: 'center', cardImageHeight: '220px', contentMaxWidth: '1000px', heroStyle: 'gradient', detailImgStyle: 'centered', btnStyle: '3d', btnSize: 'medium' }
    },
    {
        id: 'neon', name: '霓虹实验室', icon: '⚡', description: '荧光色、紧凑网格和科技感反馈',
        structure: { heroEnabled: false, homeLayout: 'compact', cardColumns: '3', cardViewMode: 'card', navbarLayout: 'left', footerStyle: 'simple', metaLayout: 'tags', detailLayout: 'sidebar' },
        style: { selectedStyle: 'neon', fontStyle: 'tech', navbarStyle: 'normal', logoStyle: 'gradient-text', cardBorder: 'thin', cardRadius: '0', cardHover: 'border-glow', categoryTitleStyle: 'dotted', categoryTitleAlign: 'left', cardImageHeight: '150px', contentMaxWidth: '1200px', heroStyle: 'minimal', detailImgStyle: 'fullwidth', btnStyle: 'ghost', btnSize: 'small' }
    },
    {
        id: 'twilight', name: '暮色画廊', icon: '🌆', description: '紫色渐变、艺术图片和宽松节奏',
        structure: { heroEnabled: true, homeLayout: 'masonry', cardColumns: '3', cardViewMode: 'card', navbarLayout: 'normal', footerStyle: 'simple', metaLayout: 'grid', detailLayout: 'single' },
        style: { selectedStyle: 'twilight', fontStyle: 'modern', navbarStyle: 'transparent', logoStyle: 'gradient-text', cardBorder: 'none', cardRadius: '16px', cardHover: 'glow', categoryTitleStyle: 'none', categoryTitleAlign: 'left', cardImageHeight: '260px', contentMaxWidth: '1200px', heroStyle: 'gradient', detailImgStyle: 'banner', btnStyle: 'pill', btnSize: 'large' }
    }
];

// ========== 领域独占模板蓝图 ==========
// 25 种母版只用于生成阶段；应用实际使用的是下方 432 个初始独立蓝图。
// 每个蓝图只有一个 domainId，ID、名称及最终结构/样式配置均不跨领域复用。
const DOMAIN_TEMPLATE_SHORT_NAMES = {
    tech: '科技', game: '游戏', food: '美食', anime: '动漫', finance: '财经', health: '健康', travel: '旅行', sports: '体育',
    automotive: '汽车', education: '教育', fashion: '时尚', home: '家居', general: '综合', entertainment: '娱乐', film: '影视', music: '音乐',
    books: '阅读', science: '科学', environment: '生态', politics: '时政', legal: '法律', realestate: '房产', career: '职场', marketing: '营销',
    ecommerce: '电商', pets: '宠物', parenting: '亲子', outdoors: '户外', photography: '摄影', history: '历史', agriculture: '农业', energy: '能源',
    naturalhistory: '自然史', marinescience: '海洋', earthscience: '地球', culturalheritage: '遗产'
};

const DOMAIN_TEMPLATE_PALETTES = {
    tech: ['carbon','celadon','neon','minimal','glacier'], game: ['retro','cyberpunk','aurora','neon','lava'],
    food: ['jade','minimal','mint','rosegold','amber'], anime: ['sakura','minimaldark','twilight','aurora','lavender'],
    finance: ['celadon','carbon','minimal','denim','crimson'], health: ['mint','minimal','jade','lavender','celadon'],
    travel: ['desert','aurora','deepsea','minimal','twilight'], sports: ['lava','carbon','celadon','retro','aurora'],
    automotive: ['carbon','crimson','minimaldark','neon','denim'], education: ['minimal','denim','mint','celadon','lavender'],
    fashion: ['rosegold','sakura','twilight','minimal','lavender'], home: ['jade','mint','rosegold','celadon','minimal'],
    general: ['minimal','denim','mint','celadon','glacier'], entertainment: ['sunset','twilight','sakura','aurora','lavender'],
    film: ['minimaldark','carbon','twilight','rosegold','deepsea'], music: ['minimaldark','neon','twilight','cyberpunk','aurora'],
    books: ['minimal','denim','rosegold','jade','mint'], science: ['glacier','carbon','celadon','deepsea','minimal'],
    environment: ['jade','deepsea','minimal','mint','desert'], politics: ['denim','minimal','celadon','crimson','carbon'],
    legal: ['minimal','denim','carbon','crimson','celadon'], realestate: ['glacier','celadon','rosegold','mint','minimal'],
    career: ['denim','celadon','minimal','carbon','mint'], marketing: ['celadon','sunset','carbon','neon','minimal'],
    ecommerce: ['glacier','mint','celadon','lavender','sunset'], pets: ['mint','lavender','jade','minimal','sakura'],
    parenting: ['lavender','mint','minimal','sakura','celadon'], outdoors: ['desert','jade','aurora','forest','deepsea'],
    photography: ['rosegold','minimaldark','twilight','glacier','minimal'], history: ['amber','minimal','rosegold','desert','denim'],
    agriculture: ['jade','forest','amber','mint','celadon'], energy: ['celadon','carbon','neon','sunset','minimal'],
    naturalhistory: ['forest','moss','jade','amber','deepsea'], marinescience: ['deepsea','ocean','tealnight','glacier','rainteal'],
    earthscience: ['glacier','desert','carbon','amber','slate'], culturalheritage: ['newsprint','amber','porcelain','terracotta','wine']
};

// 每个领域的 12 个蓝图必须使用不同配色。前五个仍优先保留领域调性，
// 后续从这个不与前项重复的通用集合补足，绝不回绕复用已有配色。
const TEMPLATE_PALETTE_EXTENSIONS = [
    'porcelain','terracotta','sage','plum','coffee','nordic','coral','cobalt',
    'moss','ivorygold','navy','peach','rainteal','wine','slate','tealnight',
    'dune','orchid','nightflight','copper','newsprint','citrus','azure','burgundy',
    'starry','dark','ocean','gradient'
];

function uniqueTemplateValues(primary, extensions, count) {
    var values = [];
    primary.concat(extensions).forEach(function(value) {
        if (values.indexOf(value) === -1 && values.length < count) values.push(value);
    });
    return values;
}

// 蓝图的名称也是视觉承诺。先满足“午夜”“深海”“霓虹”等具象主题，
// 再用领域配色补位；同一领域里仍然绝不复用配色。
const TEMPLATE_ARCHETYPE_PALETTE_PREFERENCES = {
    terminal: ['carbon', 'slate', 'navy', 'tealnight', 'nightflight'],
    brutalist: ['carbon', 'crimson', 'minimaldark', 'slate', 'copper'],
    midnight: ['minimaldark', 'nightflight', 'starry', 'navy', 'wine', 'tealnight', 'dark'],
    neon: ['neon', 'cyberpunk', 'starry', 'minimaldark', 'tealnight'],
    deepsea: ['deepsea', 'tealnight', 'navy', 'rainteal', 'ocean', 'nightflight'],
    crimson: ['crimson', 'wine', 'burgundy', 'copper', 'terracotta'],
    desert: ['desert', 'dune', 'ivorygold', 'amber', 'coffee'],
    luxury: ['rosegold', 'ivorygold', 'plum', 'wine', 'copper'],
    botanical: ['jade', 'sage', 'moss', 'forest', 'celadon'],
    pastel: ['lavender', 'sakura', 'peach', 'porcelain', 'orchid'],
    timeline: ['newsprint', 'porcelain', 'denim', 'cobalt', 'slate']
};

function pickTemplatePalette(archetypeId, fallbackPalette, usedPalettes) {
    var preferred = TEMPLATE_ARCHETYPE_PALETTE_PREFERENCES[archetypeId] || [];
    var candidates = preferred.concat(fallbackPalette, TEMPLATE_PALETTE_EXTENSIONS);
    return candidates.find(function(paletteId) {
        return usedPalettes.indexOf(paletteId) === -1;
    });
}

const DOMAIN_TEMPLATE_MODES = {
    data: {
        domains: ['tech','finance','science','politics','legal','career','marketing','energy','marinescience','earthscience'],
        fonts: ['monospace','clean','tech','modern','display','space-grotesk','ibm-plex','source-serif','roboto-mono','barlow-condensed','rubik','archivo'], imageHeights: ['140px','160px','180px','150px','200px'],
        extensionArchetypes: ['catalog','immersive','brutalist','midnight','crimson','timeline','luxury','deepsea','bento','editorial','magazine','terminal','dashboard','neon']
    },
    visual: {
        domains: ['game','anime','travel','fashion','entertainment','film','music','outdoors','photography'],
        fonts: ['display','modern','elegant','rounded','literary','retro','handwrite','dm-sans','plus-jakarta','space-grotesk','source-serif','satisfy'], imageHeights: ['260px','220px','300px','240px','280px'],
        extensionArchetypes: ['immersive','twilight','midnight','sakura','pastel','neon','luxury','editorial','magazine','bento','deepsea','desert','crimson']
    },
    lifestyle: {
        domains: ['food','health','home','environment','pets','parenting','agriculture','naturalhistory'],
        fonts: ['rounded','literary','clean','elegant','modern','nunito-sans','rubik','cursive','dm-serif','merriweather','handwrite','kalam'], imageHeights: ['220px','180px','240px','200px','260px'],
        extensionArchetypes: ['magazine','luxury','botanical','bento','pastel','catalog','immersive','terminal','dashboard','crimson','timeline','editorial']
    },
    reference: {
        domains: ['education','general','books','history','culturalheritage'],
        fonts: ['literary','display','clean','serif','modern','source-serif','dm-serif','merriweather','condensed','plus-jakarta','ibm-plex','barlow-condensed'], imageHeights: ['180px','160px','200px','150px','220px'],
        extensionArchetypes: ['magazine','timeline','luxury','catalog','editorial','botanical','deepsea','desert','bento','pastel','immersive','terminal']
    },
    commerce: {
        domains: ['sports','automotive','realestate','ecommerce'],
        fonts: ['clean','modern','display','rounded','tech','space-grotesk','ibm-plex','archivo','barlow-condensed','roboto-mono','jetbrains','dm-sans'], imageHeights: ['200px','180px','240px','160px','220px'],
        extensionArchetypes: ['catalog','dashboard','brutalist','magazine','terminal','neon','editorial','luxury','bento','timeline','immersive','crimson']
    }
};

function getDomainTemplateMode(themeId) {
    var modeId = Object.keys(DOMAIN_TEMPLATE_MODES).find(function(id) {
        return DOMAIN_TEMPLATE_MODES[id].domains.indexOf(themeId) !== -1;
    });
    return DOMAIN_TEMPLATE_MODES[modeId || 'reference'];
}

const TEMPLATE_PRESETS = [];
Object.keys(DOMAIN_CATALOG).forEach(function(themeId, domainIndex) {
    var profile = DOMAIN_CATALOG[themeId];
    var archetypeIds = profile.blueprints.slice();
    var palette = DOMAIN_TEMPLATE_PALETTES[themeId];
    var mode = getDomainTemplateMode(themeId);
    var visualPalette = uniqueTemplateValues(palette, TEMPLATE_PALETTE_EXTENSIONS, 12);
    var templateFonts = uniqueTemplateValues(mode.fonts, [], 12);
    var templateBrands = BRAND_PRESETS[themeId] || [];
    var usedPalettes = [];
    var exclusiveIds = [];
    var primaryArchetype = TEMPLATE_ARCHETYPES.find(function(item) { return item.id === archetypeIds[0]; });

    // Preserve the existing sixth option, then add six domain-appropriate
    // structural compositions. Each choice changes page architecture rather
    // than merely changing a color palette.
    TEMPLATE_ARCHETYPES.some(function(candidate) {
        if (archetypeIds.length >= 6 || archetypeIds.indexOf(candidate.id) !== -1) return false;
        archetypeIds.push(candidate.id);
        return true;
    });
    (mode.extensionArchetypes || []).some(function(archetypeId) {
        if (archetypeIds.length >= 12) return true;
        if (archetypeIds.indexOf(archetypeId) === -1) archetypeIds.push(archetypeId);
        return false;
    });
    TEMPLATE_ARCHETYPES.some(function(candidate) {
        if (archetypeIds.length >= 12 || archetypeIds.indexOf(candidate.id) !== -1) return false;
        archetypeIds.push(candidate.id);
        return false;
    });

    archetypeIds.forEach(function(archetypeId, variantIndex) {
        var archetype = TEMPLATE_ARCHETYPES.find(function(item) { return item.id === archetypeId; });
        if (!archetype) return;
        var brand = templateBrands[variantIndex];
        var templateId = themeId + '-blueprint-' + String(variantIndex + 1).padStart(2, '0');
        var serial = domainIndex * 12 + variantIndex;
        var structure = Object.assign({}, archetype.structure);
        if (variantIndex >= 5 && primaryArchetype) {
            // The extension preserves the field-specific template family's
            // navigation and Hero convention (for example food stays a
            // normal-nav, no-Hero experience) while varying the card system.
            structure.heroEnabled = primaryArchetype.structure.heroEnabled;
            structure.navbarLayout = primaryArchetype.structure.navbarLayout;
        }
        var selectedPalette = pickTemplatePalette(archetypeId, visualPalette, usedPalettes);
        usedPalettes.push(selectedPalette);
        var style = Object.assign({}, archetype.style, {
            selectedStyle: selectedPalette,
            fontStyle: templateFonts[variantIndex],
            cardImageHeight: mode.imageHeights[variantIndex % mode.imageHeights.length],
            contentMaxWidth: (parseInt(archetype.style.contentMaxWidth, 10) + domainIndex * 2 + variantIndex + 1) + 'px',
            transitionSpeed: (0.2 + serial * 0.001).toFixed(3) + 's'
        });

        TEMPLATE_PRESETS.push({
            id: templateId,
            domainId: themeId,
            variant: variantIndex + 1,
            name: DOMAIN_TEMPLATE_SHORT_NAMES[themeId] + '·' + archetype.name,
            icon: DOMAIN_CATEGORY_EMOJI_POOLS[themeId][variantIndex],
            description: '面向' + profile.description + '，' + archetype.description,
            brand: {
                id: brand.id,
                siteTitle: brand.siteTitle,
                logoText: brand.logoText
            },
            structure: structure,
            style: style
        });
        exclusiveIds.push(templateId);
    });

    profile.blueprints = exclusiveIds;
});

// 在原有 12 个蓝图后追加新布局，保持历史模板 ID 与设置兼容。
TemplateCatalog.extendDomains(DOMAIN_CATALOG, TEMPLATE_PRESETS, BRAND_PRESETS, DOMAIN_CATEGORY_EMOJI_POOLS);
