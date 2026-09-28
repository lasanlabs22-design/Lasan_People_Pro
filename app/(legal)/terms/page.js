import { LEGAL } from "@/lib/legal";
import { LegalDocument } from "../document";

export const metadata = { title: "Terms and Conditions" };

const L = LEGAL;

const SECTIONS = [
  {
    id: "agreement",
    title: "Agreement",
    body: [
      `These Terms govern the use of Lasan People Pro (the "Service") provided by ${L.company} ("we", "us"). The organisation that subscribes to the Service is the "Customer", and the people it gives access to, including its administrators and employees, are "Users".`,
      "By signing in, you agree to these Terms. If you use the Service for your employer, your employer has agreed to them as the Customer. Where the Customer has signed a separate order form or agreement with us, that document takes precedence over these Terms where they differ.",
    ],
  },
  {
    id: "service",
    title: "The Service",
    body: [
      "The Service lets the Customer record attendance (including location-verified and face-capture check-in), manage leave, holidays and employee records, and review an audit trail of changes. Features, limits and fees are as described in the Customer's order form or plan.",
      "We may improve or change the Service from time to time. We will not remove a core feature the Customer relies on during a paid term without reasonable notice.",
    ],
  },
  {
    id: "accounts",
    title: "Accounts and security",
    body: [
      {
        list: [
          "Users must keep their passwords confidential and must not share accounts.",
          "The Customer's administrators create and manage User accounts and are responsible for revoking access when someone leaves.",
          "Tell your administrator, or us, straight away if you suspect your account has been used without permission.",
          "We may suspend an account or the Customer's access to protect the Service or other people, for example after suspected misuse, and will tell the Customer when we do.",
        ],
      },
    ],
  },
  {
    id: "customer-duties",
    title: "Customer responsibilities",
    body: [
      "The Customer is responsible for how it uses the Service with its workforce, and in particular for:",
      {
        list: [
          "Having a lawful basis to process its employees' personal data, including their location and face-capture photos, and giving them the notices and obtaining any consents the law requires, including under the Digital Personal Data Protection Act, 2023.",
          "Deciding when location and photo check-in are required, and applying them fairly and in line with applicable employment law.",
          "The accuracy of the data it and its Users enter, such as leave policies, holidays and employee details.",
          "Handling requests from its employees to access, correct or erase their data, with our help where needed.",
        ],
      },
    ],
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: [
      "Users must not:",
      {
        list: [
          "Record attendance for someone else, or falsify location, photos or other records.",
          "Try to access data or accounts they are not permitted to see, or probe, scan or test the Service's security without our written permission.",
          "Interfere with or overload the Service, or use automated means to access it except through features we provide.",
          "Upload unlawful, harmful or infringing material, or use the Service in breach of any law.",
          "Copy, resell, or reverse engineer the Service, except where the law expressly allows it.",
        ],
      },
    ],
  },
  {
    id: "data",
    title: "Customer data and privacy",
    body: [
      "The Customer owns the data it and its Users put into the Service (\"Customer Data\"). We process Customer Data only to provide, secure and support the Service, on the Customer's instructions, as its Data Processor, and as described in our Privacy Policy.",
      "We keep Customer Data confidential and protect it with reasonable security measures. If we become aware of a personal data breach affecting Customer Data, we will inform the Customer without undue delay and help it meet its legal obligations.",
      `When the Customer's subscription ends, the Customer may request an export of its data. We delete Customer Data within ${L.retentionAfterTermination} after the subscription ends, unless the law requires us to keep it.`,
    ],
  },
  {
    id: "fees",
    title: "Fees",
    body: [
      "The Customer pays the fees in its order form or plan. Unless agreed otherwise, fees are billed in advance, are exclusive of applicable taxes such as GST, and are non-refundable. If payment is overdue, we may suspend the Service after giving the Customer notice and a reasonable chance to pay.",
    ],
  },
  {
    id: "ip",
    title: "Intellectual property",
    body: [
      `The Service, its software, design and content, and the Lasan People Pro and ${L.company} names and logos belong to ${L.company}. The Customer receives a non-exclusive, non-transferable right to use the Service during its subscription. Feedback you give us may be used to improve the Service without obligation.`,
    ],
  },
  {
    id: "availability",
    title: "Availability and support",
    body: [
      "We aim to keep the Service available at all times but do not guarantee uninterrupted or error-free operation. Planned maintenance will be scheduled to minimise disruption where possible. Any service-level commitments apply only if set out in the Customer's order form.",
    ],
  },
  {
    id: "warranty",
    title: "Disclaimers",
    body: [
      "Except as expressly stated in these Terms or an order form, the Service is provided \"as is\". Location and camera readings depend on the User's device and network, and we do not warrant that they will always be accurate. The Customer remains responsible for employment decisions it makes using the Service.",
    ],
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: [
      "To the extent the law allows, neither party is liable for indirect, incidental or consequential losses, or for loss of profits, revenue or goodwill. Our total liability arising out of the Service in any twelve-month period is limited to the fees the Customer paid us for the Service in that period. Nothing in these Terms limits liability that cannot be limited by law.",
    ],
  },
  {
    id: "termination",
    title: "Suspension and termination",
    body: [
      "Either party may end the subscription as set out in the order form, or immediately by notice if the other party materially breaches these Terms and does not fix the breach within thirty days of being told about it. We may suspend access immediately where necessary to prevent harm to the Service or others. Sections on data, intellectual property, liability and governing law survive termination.",
    ],
  },
  {
    id: "law",
    title: "Governing law",
    body: [
      `These Terms are governed by the laws of India. The courts at ${L.jurisdiction} have exclusive jurisdiction over any dispute arising from them.`,
    ],
  },
  {
    id: "changes",
    title: "Changes and contact",
    body: [
      "We may update these Terms. We will give the Customer notice of material changes before they take effect; continuing to use the Service afterwards means accepting them.",
      `Questions about these Terms: ${L.company}, ${L.address}, ${L.email}.`,
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalDocument
      eyebrow="Legal"
      title="Terms and Conditions"
      updated={L.updated}
      intro={["Please read these Terms carefully. They set out the rules for using Lasan People Pro and the responsibilities of everyone who uses it."]}
      sections={SECTIONS}
    />
  );
}
