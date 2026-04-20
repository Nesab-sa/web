/**
 * Nesab — Founder Data Layer v1.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Single runtime source of truth for all founder-related content.
 * Mirrors founder.json — edit founder.json, then sync this object.
 *
 * Responsibilities:
 *  1. Expose window.FOUNDER for any script that needs founder data.
 *  2. Inject JSON-LD Person + Organization schema into <head>.
 *  3. Populate any DOM element with a [data-founder="<field>"] attribute.
 *
 * Supported data-founder field values:
 *  name-en | name-ar | role-en | role-ar
 *  bio-tagline | bio-tagline-en
 *  bio-one-liner | bio-one-liner-en
 *  bio-short | bio-short-en
 *  bio-medium | bio-medium-en
 *  bio-full | bio-full-en
 *  bio-footer-ar | bio-media | bio-media-en
 *  contact-email | contact-linkedin | contact-whatsapp
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════════════════════
     DATA OBJECT  —  mirrors founder.json
     To update globally: edit founder.json first, then update here.
  ═══════════════════════════════════════════════════════════════════════════ */
  var FOUNDER = {
    name:            { en: 'Abdullah Almalki', ar: 'عبدالله المالكي' },
    slug:            'abdullah-almalki',
    role:            { en: 'Founder of Nesab', ar: 'مؤسس نِسَب' },
    yearsExperience: 19,

    contact: {
      email:     'abdullahalmalki@nesab.sa',
      linkedin:  'https://www.linkedin.com/in/abdullah-almalkiii',
      whatsapp:  '+966500768074'
    },

    bio: {
      tagline: {
        en: 'Banking Expertise. Fintech Execution. AI Innovation.',
        ar: 'خبرة مصرفية. تنفيذ فينتك. ابتكار بالذكاء الاصطناعي.'
      },
      oneLiner: {
        en: 'Abdullah Almalki is building the future of financial access by combining banking expertise, fintech execution, and applied artificial intelligence.',
        ar: 'عبدالله المالكي يبني مستقبل الوصول المالي بالجمع بين الخبرة المصرفية وتنفيذ التقنية المالية والذكاء الاصطناعي التطبيقي.'
      },
      short: {
        en: 'Abdullah Almalki is the Founder of Nesab, a fintech builder, and a financial services leader with 19+ years of banking experience focused on AI-enabled financial innovation.',
        ar: 'عبدالله المالكي مؤسس نِسَب، وقائد في الخدمات المالية بخبرة مصرفية تتجاوز 19 عامًا، يركز على الابتكار المالي المدعوم بالذكاء الاصطناعي.'
      },
      medium: {
        en: 'Abdullah Almalki is the Founder of Nesab and a financial services leader with 19+ years of banking experience. His background spans credit, branch leadership, customer journeys, and operational performance. He now focuses on building AI-enabled financial products and scalable fintech solutions that simplify and improve access to financial services.',
        ar: 'عبدالله المالكي مؤسس نِسَب وقائد في الخدمات المالية بخبرة مصرفية تمتد لأكثر من 19 عامًا. تشمل خلفيته الائتمان وإدارة الفروع ورحلات العملاء والأداء التشغيلي. يركز حالياً على بناء منتجات مالية مدعومة بالذكاء الاصطناعي وحلول فينتك قابلة للتوسع.'
      },
      full: {
        en: 'Abdullah Almalki is the Founder of Nesab and a senior leader in financial services, banking operations, digital transformation, and applied financial technology. He brings more than 19 years of professional banking experience developed through frontline advisory roles, relationship management, branch leadership, and executive operational responsibility.\n\nHis career combines deep practical expertise in banking products, credit solutions, customer behavior, sales performance, and operational management with the ability to convert market needs into scalable digital products.\n\nHe is recognized for bridging traditional financial expertise with modern execution models, including fintech systems, automation, customer-experience design, and AI-enabled service delivery.\n\nThrough Nesab, he is building a next-generation financial platform focused on simplifying access to financial solutions, improving customer financial decisions, increasing execution efficiency, and delivering intelligent products designed for real market demand.',
        ar: 'عبدالله المالكي مؤسس نِسَب وقائد كبير في الخدمات المالية والعمليات المصرفية والتحول الرقمي وتكنولوجيا المالية التطبيقية. يمتلك أكثر من 19 عامًا من الخبرة المصرفية المهنية تطورت عبر أدوار استشارية ميدانية وإدارة علاقات وقيادة فروع ومسؤولية تشغيلية تنفيذية.'
      },
      media: {
        en: 'Abdullah Almalki, Founder of Nesab, is a Saudi financial services leader and fintech entrepreneur with over 19 years of banking experience. He specializes in credit, digital transformation, and AI-powered financial products designed to modernize customer access to financial solutions.',
        ar: 'عبدالله المالكي، مؤسس نِسَب، قائد سعودي في الخدمات المالية ورائد أعمال في مجال التقنية المالية بخبرة مصرفية تتجاوز 19 عامًا. متخصص في الائتمان والتحول الرقمي والمنتجات المالية المدعومة بالذكاء الاصطناعي.'
      },
      footerAr: 'قائد في الخدمات المالية والتحول الرقمي، ومستشار ائتماني معتمد، بخبرة مصرفية تمتد لأكثر من 19 عامًا، تدرج خلالها في المناصب القيادية حتى إدارة الفروع. يركز على الابتكار المصرفي والتقنية المالية وتوظيف الذكاء الاصطناعي لتطوير الخدمات المالية وبناء حلول أكثر كفاءة وقابلة للتوسع، بما يعزز النمو ويرتقي بتجربة العملاء.'
    },

    organization: {
      name:    'Nesab',
      url:     'https://nesab.sa',
      logo:    'https://nesab.sa/assets/applogo_light.png',
      country: 'Saudi Arabia',
      sector:  'Financial Technology'
    }
  };

  // Expose globally — any script can read window.FOUNDER
  window.FOUNDER = FOUNDER;


  /* ═══════════════════════════════════════════════════════════════════════════
     JSON-LD SCHEMA  —  Person + Organization (schema.org)
  ═══════════════════════════════════════════════════════════════════════════ */
  function injectSchema() {
    var schema = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Person',
          '@id': 'https://nesab.sa/#founder',
          'name': FOUNDER.name.en,
          'alternateName': FOUNDER.name.ar,
          'jobTitle': FOUNDER.role.en,
          'description': FOUNDER.bio.short.en,
          'nationality': {
            '@type': 'Country',
            'name': 'Saudi Arabia'
          },
          'url': FOUNDER.organization.url,
          'email': FOUNDER.contact.email,
          'sameAs': [
            FOUNDER.contact.linkedin,
            'https://nesab.sa'
          ],
          'knowsAbout': [
            'Banking and Credit',
            'Consumer Finance',
            'Fintech',
            'AI in Financial Services',
            'Digital Transformation',
            'Credit Advisory'
          ],
          'worksFor': {
            '@type': 'Organization',
            '@id': 'https://nesab.sa/#organization'
          },
          'founder': {
            '@type': 'Organization',
            '@id': 'https://nesab.sa/#organization'
          }
        },
        {
          '@type': 'Organization',
          '@id': 'https://nesab.sa/#organization',
          'name': FOUNDER.organization.name,
          'url': FOUNDER.organization.url,
          'logo': {
            '@type': 'ImageObject',
            'url': FOUNDER.organization.logo
          },
          'foundingLocation': {
            '@type': 'Country',
            'name': FOUNDER.organization.country
          },
          'founder': {
            '@type': 'Person',
            '@id': 'https://nesab.sa/#founder',
            'name': FOUNDER.name.en
          },
          'industry': FOUNDER.organization.sector,
          'description': 'Nesab is a Saudi fintech platform delivering AI-powered financial advisory tools and precision calculators for banking professionals and consumers.',
          'sameAs': ['https://nesab.sa']
        }
      ]
    };

    var script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'founder-schema-ld';
    script.textContent = JSON.stringify(schema, null, 2);
    document.head.appendChild(script);
  }


  /* ═══════════════════════════════════════════════════════════════════════════
     DOM POPULATION  —  [data-founder="<field>"] elements
  ═══════════════════════════════════════════════════════════════════════════ */
  var FIELDS = {
    'name-en':          function () { return FOUNDER.name.en; },
    'name-ar':          function () { return FOUNDER.name.ar; },
    'role-en':          function () { return FOUNDER.role.en; },
    'role-ar':          function () { return FOUNDER.role.ar; },
    'bio-tagline':      function () { return FOUNDER.bio.tagline.ar; },
    'bio-tagline-en':   function () { return FOUNDER.bio.tagline.en; },
    'bio-one-liner':    function () { return FOUNDER.bio.oneLiner.ar; },
    'bio-one-liner-en': function () { return FOUNDER.bio.oneLiner.en; },
    'bio-short':        function () { return FOUNDER.bio.short.ar; },
    'bio-short-en':     function () { return FOUNDER.bio.short.en; },
    'bio-medium':       function () { return FOUNDER.bio.medium.ar; },
    'bio-medium-en':    function () { return FOUNDER.bio.medium.en; },
    'bio-full':         function () { return FOUNDER.bio.full.ar; },
    'bio-full-en':      function () { return FOUNDER.bio.full.en; },
    'bio-footer-ar':    function () { return FOUNDER.bio.footerAr; },
    'bio-media':        function () { return FOUNDER.bio.media.ar; },
    'bio-media-en':     function () { return FOUNDER.bio.media.en; },
    'contact-email':    function () { return FOUNDER.contact.email; },
    'contact-linkedin': function () { return FOUNDER.contact.linkedin; },
    'contact-whatsapp': function () { return FOUNDER.contact.whatsapp; }
  };

  var LINK_FIELDS = {
    'contact-email':    function (v) { return 'mailto:' + v; },
    'contact-linkedin': function (v) { return v; },
    'contact-whatsapp': function (v) { return 'https://wa.me/' + v.replace(/\D/g, ''); }
  };

  function populate() {
    var els = document.querySelectorAll('[data-founder]');
    for (var i = 0; i < els.length; i++) {
      var el    = els[i];
      var field = el.getAttribute('data-founder');
      if (!FIELDS[field]) continue;
      var value = FIELDS[field]();

      if (el.tagName === 'A' && LINK_FIELDS[field]) {
        el.href = LINK_FIELDS[field](value);
      } else {
        el.textContent = value;
      }
    }
  }


  /* ═══════════════════════════════════════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════════════════════════════════════ */
  function init() {
    injectSchema();
    populate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
