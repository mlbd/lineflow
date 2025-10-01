// components/Faqs.jsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

/* -------------------- Data -------------------- */
const TAB_SECTIONS = [
  {
    id: 'general',
    label: 'General',
    faqs: [
      {
        q: 'What is LineFlow?',
        a: 'LineFlow is an online store for branded products like notebooks, envelopes, stickers, apparel and more—everything you can use to brand your business.',
      },
      {
        q: 'Is there a minimum order?',
        a: 'Minimum order depends on the product and print method. You’ll see the minimum on each product page before adding to cart.',
      },
      {
        q: 'Do the prices include VAT?',
        a: 'Prices are shown before VAT unless otherwise stated. VAT is calculated at checkout based on your location.',
      },
      {
        q: 'What are the shipping options?',
        a: 'We offer standard and express shipping. Options and ETAs are calculated at checkout after you enter your address.',
      },
      {
        q: 'Is self-collection possible?',
        a: 'Yes—self-collection is available at select locations. Choose “Self-collection” at checkout if it appears for your order.',
      },
    ],
  },
  {
    id: 'products',
    label: 'Products',
    faqs: [
      {
        q: 'Which products can be branded?',
        a: 'Most items across stationery, packaging, apparel and gifts support logo placement. Each product page lists compatible print methods.',
      },
      {
        q: 'Can I upload my logo?',
        a: 'Yes. Upload vector (SVG, PDF, AI) or high-res PNG (300dpi). Our preflight checks will validate and guide you.',
      },
    ],
  },
  {
    id: 'pricing',
    label: 'Pricing & Payment',
    faqs: [
      {
        q: 'How are discounts applied?',
        a: 'Volume and coupon discounts are validated server-side at checkout to ensure accurate totals.',
      },
      {
        q: 'Which payment methods are supported?',
        a: 'All major cards and local options where available. Additional gateways can appear based on your region.',
      },
    ],
  },
  {
    id: 'security',
    label: 'Security & Privacy',
    faqs: [
      {
        q: 'How is my data protected?',
        a: 'We use TLS for all transport, never store raw card data, and apply least-privilege access to sensitive systems.',
      },
      {
        q: 'Do you share my files?',
        a: 'Your artwork is used only to fulfill your orders unless you explicitly grant permission.',
      },
    ],
  },
  {
    id: 'technical',
    label: 'Technical Support',
    faqs: [
      {
        q: 'Having trouble uploading?',
        a: 'Try a supported format under 50MB. If it still fails, contact support with your order ID and file type.',
      },
      {
        q: 'How to report a bug?',
        a: 'Send steps to reproduce, screenshots, and your browser version to support. We typically respond within one business day.',
      },
    ],
  },
];

/* -------------------- Hook: slideDown/slideUp -------------------- */
function useSlide(open) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const duration = 240; // ms
    el.style.willChange = 'height, opacity';

    if (open) {
      // open: 0 -> auto
      el.style.display = 'block';
      el.style.overflow = 'hidden';
      el.style.height = '0px';
      el.style.opacity = '0';

      requestAnimationFrame(() => {
        const target = el.scrollHeight;
        el.style.transition = `height ${duration}ms ease, opacity ${duration}ms ease`;
        el.style.height = `${target}px`;
        el.style.opacity = '1';

        const end = () => {
          el.style.transition = '';
          el.style.height = 'auto';
          el.style.overflow = 'visible';
          el.removeEventListener('transitionend', end);
        };
        el.addEventListener('transitionend', end);
      });
    } else {
      // close: current -> 0
      const current = el.getBoundingClientRect().height;
      if (current === 0) {
        el.style.display = 'none';
        return;
      }
      el.style.overflow = 'hidden';
      el.style.height = `${current}px`;
      el.style.opacity = '1';

      requestAnimationFrame(() => {
        el.style.transition = `height ${duration}ms ease, opacity ${duration}ms ease`;
        el.style.height = '0px';
        el.style.opacity = '0';

        const end = () => {
          el.style.transition = '';
          el.style.display = 'none';
          el.removeEventListener('transitionend', end);
        };
        el.addEventListener('transitionend', end);
      });
    }
  }, [open]);

  return ref;
}

/* -------------------- Child: Accordion Item (isolates hooks) -------------------- */
function AccordionItem({ id, question, answer, open, onToggle }) {
  const panelRef = useSlide(open);

  return (
    <li>
      <button
        type="button"
        className="group flex w-full items-center justify-between px-5 py-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={onToggle}
      >
        <span className="text-base font-semibold text-slate-900 group-hover:text-indigo-700">
          {question}
        </span>
        <span
          className={`inline-flex h-9 w-9 items-center justify-center rounded-[8px] cursor-pointer ${
            open
              ? 'bg-grad-1 bg-no-repeat bg-cover shadow-[0px_6px_20px_0px_rgba(13,0,113,0.20)]'
              : 'bg-indigo-50 group-hover:bg-indigo-100'
          }`}
        >
          {open ? (
            <Minus className="h-5 w-5 text-white" aria-hidden />
          ) : (
            <Plus className="h-5 w-5 text-indigo-700" aria-hidden />
          )}
        </span>
      </button>

      <div
        id={`${id}-panel`}
        role="region"
        aria-labelledby={`${id}-button`}
        ref={panelRef}
        // initial collapsed state; JS will manage to "auto" when open
        style={{ display: 'none', height: 0, opacity: 0, overflow: 'hidden' }}
        className="px-5 pr-14 text-slate-700"
      >
        <div className="pb-5 pt-1">{answer}</div>
      </div>
    </li>
  );
}

/* -------------------- Main Component -------------------- */
export default function Faqs() {
  const [activeTab, setActiveTab] = useState(TAB_SECTIONS[0].id);
  const [openItem, setOpenItem] = useState(null);

  const section = TAB_SECTIONS.find(t => t.id === activeTab);

  const handleToggle = key => {
    setOpenItem(prev => (prev === key ? null : key));
  };

  return (
    <>
      <section className="relative container mx-auto pt-[80px] pb-[100px]">
        <div className="text-center mb-[50px]">
          <h2 className="typo-h2 font-bold text-secondary mb-[25px]">
            Frequently <span className="text-tertiary">Asked</span> Questions
          </h2>
          <p className="typo-body">
            Have questions? We’ve got you covered! Explore quick answers about <br /> our services
            and more.
          </p>
        </div>
        {/* 30% / 70% split, sidebar LEFT */}
        <div className="grid gap-8 md:grid-cols-[30%_70%]">
          {/* Left: sticky vertical tabs */}
          <aside className="md:sticky md:top-20 md:self-start">
            <div className="rounded-2xl bg-indigo-50 p-8">
              <nav aria-label="FAQ sections" className="space-y-1">
                {TAB_SECTIONS.map(t => {
                  const active = t.id === activeTab;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(t.id);
                        setOpenItem(null); // reset open item when switching tabs
                      }}
                      className={[
                        'w-full rounded-xl px-4 py-3 text-left transition cursor-pointer',
                        active
                          ? 'bg-white text-tertiary shadow-sm border-l-3 border-tertiary'
                          : 'text-slate-700 hover:bg-white/70',
                      ].join(' ')}
                      aria-current={active ? 'page' : undefined}
                    >
                      <span className="font-medium">{t.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Right: accordions for active tab */}
          <div>
            <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200">
              {section?.faqs.map((item, idx) => {
                const key = `${activeTab}-${idx}`;
                const open = openItem === key;

                return (
                  <AccordionItem
                    key={key}
                    id={key}
                    question={item.q}
                    answer={item.a}
                    open={open}
                    onToggle={() => handleToggle(key)}
                  />
                );
              })}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
