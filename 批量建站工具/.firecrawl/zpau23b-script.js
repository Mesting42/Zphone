(function() {
    // 网站配置
    var CONFIG = {
        dataFile: 'data.json',
        categories: [{"name":"Ancient World","key":"cat-0","count":3},{"name":"Modern History","key":"cat-1","count":6},{"name":"People","key":"cat-2","count":6},{"name":"Archaeology","key":"cat-3","count":6},{"name":"Culture","key":"cat-4","count":6}],
        cardFields: ["title","image","excerpt"],
        randomSort: true,
        siteName: 'HeritageGuide',
        imageField: 'image',
        hasId: false
    };

    // Fisher-Yates洗牌算法
    function shuffleArray(arr) {
        var array = arr.slice();
        for (var i = array.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
        return array;
    }

    // 数据加载
    function loadData(callback) {
        fetch(CONFIG.dataFile)
            .then(function(res) { return res.json(); })
            .then(function(data) {
                if (!Array.isArray(data)) {
                    // 兼容对象包裹格式
                    var keys = Object.keys(data);
                    for (var i = 0; i < keys.length; i++) {
                        if (Array.isArray(data[keys[i]])) {
                            data = data[keys[i]];
                            break;
                        }
                    }
                }
                // 确保每条数据有id或_index
                for (var i = 0; i < data.length; i++) {
                    if (!data[i].id && data[i].id !== 0) {
                        data[i]._index = i + 1;
                    }
                }
                callback(data);
            })
            .catch(function(err) {
                console.error('Failed to load data:', err);
                var main = document.querySelector('.main-content');
                if (main) main.innerHTML = '<p>Failed to load data.</p>';
            });
    }

    // 创建卡片DOM
    function createCard(item, idx) {
        var card = document.createElement('a');
        var itemId = item.id !== undefined && item.id !== null ? item.id : (item._index || idx + 1);
        card.className = 'item-card';
        card.href = 'details/article' + itemId + '.html';

        var html = '';
        // 图片
        if (CONFIG.cardFields.indexOf('image') !== -1 && item[CONFIG.imageField]) {
            html += '<div class="card-image-frame"><img class="card-image image-cover" src="' + item[CONFIG.imageField] + '" alt="' + (item.title || '') + '" loading="lazy"></div>';
        }
        html += '<div class="card-body">';

        // 遍历配置的展示字段
        for (var i = 0; i < CONFIG.cardFields.length; i++) {
            var field = CONFIG.cardFields[i];
            if (field === 'image') continue;
            var val = item[field];
            if (val === undefined || val === null) continue;

            if (field === 'title') {
                html += '<div class="card-title">' + val + '</div>';
            } else if (field === 'excerpt') {
                html += '<p class="card-desc">' + val + '</p>';
            } else if (field === 'price') {
                var isFree = String(val).toLowerCase() === 'free';
                html += '<div class="card-price' + (isFree ? ' price-free' : '') + '">' + val + '</div>';
            } else if (field === 'genres' || field === 'cuisine') {
                html += '<div class="card-' + field + '">' + val + '</div>';
            } else {
                html += '<div class="card-' + field + '">' + val + '</div>';
            }
        }
        html += '</div>';
        card.innerHTML = html;
        return card;
    }

    // 所有模板共用统一封面框，图片始终铺满容器。
    function adaptCardImage(img) {
        if (!img) return;
        var frame = img.parentElement;
        if (!frame || !frame.classList.contains('card-image-frame')) {
            frame = document.createElement('div');
            frame.className = 'card-image-frame';
            img.parentNode.insertBefore(frame, img);
            frame.appendChild(img);
        }
        img.classList.add('image-cover');
    }

    // 渲染分类和卡片
    function renderCategories(data) {
        var usedItems = [];

        for (var c = 0; c < CONFIG.categories.length; c++) {
            var cat = CONFIG.categories[c];
            var grid = document.querySelector('.items-grid[data-category="cat-' + c + '"]');
            if (!grid) continue;

            // 分配卡片到分类
            var available = data.filter(function(d) {
                return usedItems.indexOf(d) === -1;
            });
            if (CONFIG.randomSort) {
                available = shuffleArray(available);
            }
            var count = Math.min(cat.count, available.length);
            grid.classList.remove('item-count-1', 'item-count-2', 'item-count-3', 'item-count-4', 'item-count-6');
            if (count === 1) grid.classList.add('item-count-1');
            if (count === 2) grid.classList.add('item-count-2');
            if (count === 3) grid.classList.add('item-count-3');
            if (count === 4) grid.classList.add('item-count-4');
            if (count === 6) grid.classList.add('item-count-6');
            for (var i = 0; i < count; i++) {
                var card = createCard(available[i], i);
                grid.appendChild(card);
                adaptCardImage(card.querySelector('.card-image'));
                usedItems.push(available[i]);
            }
        }
    }

    window.addEventListener('resize', function() {
        var images = document.querySelectorAll('.item-card .card-image');
        for (var i = 0; i < images.length; i++) adaptCardImage(images[i]);
    });

    // 汉堡菜单交互
    function initNavbar() {
        var hamburger = document.querySelector('.hamburger');
        var navLinks = document.querySelector('.nav-links');
        var drawerPanel = document.querySelector('.side-drawer-panel');
        var drawerOverlay = document.querySelector('.drawer-overlay');
        var drawerClose = document.querySelector('.drawer-close');
        function setExpanded(expanded) {
            if (hamburger) hamburger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        }
        function closeNavigation() {
            if (navLinks) navLinks.classList.remove('active');
            if (drawerPanel) drawerPanel.classList.remove('open');
            if (drawerOverlay) drawerOverlay.classList.remove('active');
            setExpanded(false);
        }
        if (hamburger && navLinks) {
            hamburger.addEventListener('click', function() {
                var willOpen = !navLinks.classList.contains('active');
                navLinks.classList.toggle('active', willOpen);
                setExpanded(willOpen);
            });
            var links = navLinks.querySelectorAll('a');
            for (var i = 0; i < links.length; i++) {
                links[i].addEventListener('click', closeNavigation);
            }
        }
        // 侧边抽屉交互
        if (drawerPanel) {
            function openDrawer() {
                drawerPanel.classList.add('open');
                if (drawerOverlay) drawerOverlay.classList.add('active');
                setExpanded(true);
            }
            if (hamburger) hamburger.addEventListener('click', openDrawer);
            if (drawerClose) drawerClose.addEventListener('click', closeNavigation);
            if (drawerOverlay) drawerOverlay.addEventListener('click', closeNavigation);
            var dLinks = drawerPanel.querySelectorAll('a');
            for (var j = 0; j < dLinks.length; j++) {
                dLinks[j].addEventListener('click', closeNavigation);
            }
        }
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') closeNavigation();
        });
    }

    // 初始化
    function init() {
        initNavbar();
        var mainContent = document.querySelector('.main-content');
        if (mainContent) {
            loadData(function(data) {
                if (data && data.length > 0) {
                    renderCategories(data);
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();