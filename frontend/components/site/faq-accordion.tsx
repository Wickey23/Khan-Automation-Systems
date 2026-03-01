import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  {
    q: "Will this replace my staff?",
    a: "No. It captures calls and follow-up when your team is busy or after-hours, then hands off to humans when needed."
  },
  {
    q: "What if the AI gets something wrong?",
    a: "Every setup has guardrails, escalation paths, and script controls. We monitor performance and tune weekly."
  },
  {
    q: "Can it transfer to a service manager?",
    a: "Yes. Transfer logic can route by business hours, job urgency, and issue type."
  },
  {
    q: "Does it integrate with our current tools?",
    a: "Yes. We start with what you already use and add only what improves speed and reliability."
  }
];

export function FAQAccordion() {
  return (
    <Accordion type="single" collapsible className="w-full">
      {faqs.map((faq, index) => (
        <AccordionItem key={faq.q} value={`item-${index}`}>
          <AccordionTrigger>{faq.q}</AccordionTrigger>
          <AccordionContent>{faq.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
