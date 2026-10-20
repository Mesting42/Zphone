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
            { id: 'image', label: 'Image', labelZh: '文章头图', required: true, detailDisplay: 'hero-image' },
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
            { id: 'image', label: 'Image', labelZh: '游戏头图', required: true, detailDisplay: 'hero-image' },
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
            { name: 'Strategy Games', icon: '♟️', count: 6 }
        ],
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
            { id: 'image', label: 'Image', labelZh: '美食图片', required: true, detailDisplay: 'hero-image' },
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
            { id: 'image', label: 'Image', labelZh: '动漫图片', required: true, detailDisplay: 'hero-image' },
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
