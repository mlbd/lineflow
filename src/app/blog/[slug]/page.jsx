import Footer from '@/components/common/Footer';
import HeroSection from '@/components/page/HeroSection';
import TopBar from '@/components/page/TopBar';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import styles from './post.module.css';

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
  const { slug } = await params;
  if (!slug) return notFound();

  const post = await fetchPostBySlug(slug);
  if (!post) return notFound();

  const title = post.title?.rendered ?? '';
  const content = post.content?.rendered ?? '';
  const excerptText = (post.excerpt?.rendered ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
  const date = (() => {
    try {
      return new Date(post.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (e) {
      return post.date;
    }
  })();
  const author = post._embedded?.author?.[0]?.name ?? '';
  const image = getFeaturedImage(post);

  return (
    <>
      <Head>
        <title>{title} — LineFlow</title>
        <meta
          name="description"
          content={(post.excerpt?.rendered ?? '').replace(/<[^>]+>/g, '').slice(0, 160)}
        />
      </Head>

      <main>
        <TopBar />

        {/* Hero with post title */}
        <HeroSection title={<span dangerouslySetInnerHTML={{ __html: title }} />} />

        {/* Post content area */}
        <section className="container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto">
            <div className={styles.blogPost}>
              <div className="mb-6 text-sm text-gray-500">
                {date} {author ? <>&bull; {author}</> : null}
              </div>

              {/* Featured image */}
              {image ? (
                <div className="relative mb-8 rounded-2xl overflow-hidden shadow-sm h-64 md:h-96">
                  <Image
                    src={image}
                    alt={typeof title === 'string' ? title : 'Featured image'}
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
              ) : null}

              <article className="prose prose-lg max-w-none text-gray-700">
                <div dangerouslySetInnerHTML={{ __html: content }} />
              </article>

              <div className="mt-8">
                <Link href="/blog" className="text-primary-500 font-medium">
                  ← Back to articles
                </Link>
              </div>
            </div>
          </div>
        </section>

        <Footer year={new Date().getFullYear()} />
      </main>
    </>
  );
}
