// src/components/page/InfoBoxSection.jsx

const defaultBoxes = [
  {
    icon: '/device-mini.svg',
    title: 'כאן בשבילך',
    text: 'לכל שאלה, התלבטות או התייעצות, נשמח לעזור בכל דבר. זמינים במגוון דרכים: טלפון, אימייל וכמובן גם בווטסאפ.',
  },
  {
    icon: '/rocket-mini.svg',
    title: 'משלוחים מהירים',
    text: 'בין 2-5 ימי עסקים וההזמנה אצלכם! משלוח אקספרס של חברת UPS, שירות משלוחים ברמה הגבוהה ביותר',
  },
  {
    icon: '/hand-mini.svg',
    title: 'פשוט ומהיר',
    text: 'יצרנו מערכת אישית בשבילך שבכמה קליקים פשוטים תוכלו לבצע הזמנה ולשדרג את העסק שלכם, ממש בכמה דקות',
  },
];

// Props: infoBoxes (optional), falls back to defaultBoxes
export default function InfoBoxSection({ infoBoxes = defaultBoxes }) {
  return (
    <section className="w-full py-[50px] flex justify-center bg-[#f1f1f1]">
      <div className="max-w-[var(--site-max-width)] w-full grid grid-cols-1 md:grid-cols-3 gap-6 px-4">
        {infoBoxes.map((box, i) => (
          <div
            key={i}
            className="flex flex-col items-center"
          >
            <div className="flex items-center justify-center h-[70px] [70px] mb-4">
              <img
                src={box.icon}
                alt={box.title}
                className="w-full h-auto max-w-[70px] max-h-[70px]"
                loading="lazy"
              />
            </div>
            <h3 className="text-xl font-bold mb-2 text-center">{box.title}</h3>
            <p className="text-sm font-normal text-center">{box.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
