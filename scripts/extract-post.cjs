const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);

(async () => {
  const [post] = await sql`
    SELECT id, title, slug, body_html, excerpt, meta_title, meta_description,
           category, primary_keyword, secondary_keywords, seo_score, word_count,
           cover_image_url, source, published, published_at,
           internal_links, external_links, faq_data, readability_score,
           cause_category, author_name, topic_id
    FROM blog_posts
    WHERE slug = 'creative-church-fundraiser-ideas-to-inspire-your-community'
  `;
  
  fs.writeFileSync('temp-blog-post.json', JSON.stringify(post, null, 2));
  
  console.log('=== METADATA ===');
  console.log('Title:', post.title);
  console.log('Category:', post.category);
  console.log('Keyword:', post.primary_keyword);
  console.log('Secondary:', JSON.stringify(post.secondary_keywords));
  console.log('SEO Score:', post.seo_score);
  console.log('Word Count:', post.word_count);
  console.log('Readability:', post.readability_score);
  console.log('Cover Image:', post.cover_image_url);
  console.log('Published:', post.published);
  console.log('Author:', post.author_name);
  console.log('Cause Category:', post.cause_category);
  console.log('Meta Title:', post.meta_title);
  console.log('Meta Desc:', post.meta_description);
  console.log('Body HTML length:', post.body_html?.length);
  console.log('Excerpt:', post.excerpt);
  
  console.log('\n=== INTERNAL LINKS (stored in DB) ===');
  console.log(JSON.stringify(post.internal_links, null, 2));
  
  console.log('\n=== EXTERNAL LINKS (stored in DB) ===');
  console.log(JSON.stringify(post.external_links, null, 2));
  
  console.log('\n=== FAQ DATA ===');
  console.log(JSON.stringify(post.faq_data, null, 2));
  
  // Parse actual links from HTML body
  const body = post.body_html || '';
  const linkRegex = /<a\s+[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi;
  const imgRegex = /<img\s+[^>]*src=["']([^"']*)["'][^>]*\/?>/gi;
  
  const links = [];
  let m;
  while ((m = linkRegex.exec(body)) !== null) {
    links.push({ href: m[1], text: m[2].replace(/<[^>]*>/g, '').trim() });
  }
  
  const images = [];
  while ((m = imgRegex.exec(body)) !== null) {
    images.push({ src: m[1], tag: m[0].substring(0, 120) });
  }
  
  console.log('\n=== LINKS FOUND IN BODY HTML (' + links.length + ') ===');
  links.forEach((l, i) => {
    const type = l.href.startsWith('/') || l.href.includes('lastdonor') ? 'INTERNAL' : 'EXTERNAL';
    console.log(`  [${type}] "${l.text}" → ${l.href}`);
  });
  
  console.log('\n=== IMAGES FOUND IN BODY HTML (' + images.length + ') ===');
  images.forEach((img, i) => {
    console.log(`  [IMG ${i+1}] ${img.src}`);
  });
  
  console.log('\n=== FULL BODY HTML ===');
  console.log(body);
  
  await sql.end();
})();
