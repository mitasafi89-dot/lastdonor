import { NewsletterForm } from './NewsletterForm';

export function Newsletter() {
  return (
    <section id="newsletter" className="bg-surface-amber py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <NewsletterForm />
      </div>
    </section>
  );
}
