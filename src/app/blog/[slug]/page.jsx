import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import TopBar from '@/components/page/TopBar';
import Footer from '@/components/common/Footer';
import { notFound } from 'next/navigation';

const WP_BASE = process.env.WP_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '';

async function fetchPostBySlug(slug) {
  if (!WP_BASE) return null;
  const url = `${WP_BASE.replace(/\/$/, '')}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_embed`;
  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  } catch (err) {
    console.error('Failed to fetch post', err);
    return null;
  }
}

function getFeaturedImage(post) {
  try {
    const media = post._embedded?.['wp:featuredmedia']?.[0];
    if (media && media.source_url) return media.source_url;
  } catch (e) {}
  return '/images/affiliate/Video.png';
}

export default async function BlogPostPage({ params }) {
  const slug = params?.slug;
  if (!slug) return notFound();

  const post = await fetchPostBySlug(slug);
  if (!post) return notFound();

  const title = post.title?.rendered ?? '';
  const content = post.content?.rendered ?? '';
  const date = new Date(post.date).toLocaleDateString();
  const author = post._embedded?.author?.[0]?.name ?? '';
  const image = getFeaturedImage(post);

  return (
    <>
      <Head>
        <title>{title} — LineFlow</title>
        <meta name="description" content={(post.excerpt?.rendered ?? '').replace(/<[^>]+>/g, '').slice(0, 160)} />
      </Head>

      <main>
        <TopBar />

        <section className="container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto">
            <div className="text-sm text-gray-500 mb-2">{date} • {author}</div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-6" dangerouslySetInnerHTML={{ __html: title }} />

            <div className="relative h-64 md:h-96 mb-6 rounded-2xl overflow-hidden">
              <Image src={image} alt={title} fill className="object-cover" />
            </div>

            <article className="prose prose-lg max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: content }} />

            <div className="mt-8">
              <Link href="/blog" className="text-primary-500 font-medium">← Back to articles</Link>
            </div>
          </div>
        </section>

        <Footer />
      </main>
    </>
  );
}
