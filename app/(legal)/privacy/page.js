import { LEGAL } from "@/lib/legal";
import { LegalDocument } from "../document";

export const metadata = { title: "Privacy Policy" };

// Every item listed here matches what the app actually stores (server/db/schema.js). Update both
// together. Written for a single organisation's staff: nothing here refers to other customers.
const L = LEGAL;

const SECTIONS = [
  {
    id: "who",
    title: "Who we are and our role",
    body: [
      `Lasan People Pro is an attendance, leave and people-management service provided by ${L.company} ("we", "us"). Your employer (the "Organisation") uses the service to manage its workforce.`,
      "Under India's Digital Personal Data Protection Act, 2023 (the \"DPDP Act\"), your employer decides why and how your personal data is processed and is the Data Fiduciary. We process that data on your employer's behalf, as its Data Processor, and only on its instructions. For data about your use of this website itself, such as sign-in security records, we act as Data Fiduciary.",
    ],
  },
  {
    id: "collect",
    title: "Personal data we process",
    body: [
      "Depending on how your Organisation uses the service, we process:",
      {
        list: [
          "Identity and employment details: your name, employee ID, work email, gender, designation, department and date of joining.",
          "Profile details you choose to add: profile photo, phone number, date of birth, blood group, address and an emergency contact's name, relationship and phone number.",
          "Attendance records: check-in and check-out times and, when your Organisation requires location, the GPS position, its accuracy, the nearest office and your distance from it at the moment you punch.",
          "Face-capture photos: when your Organisation turns on photo check-in for you, a photo taken live with your device's camera at each check-in and check-out.",
          "Leave and time off: leave requests, dates, reasons, approvals and balances, and the Organisation's holiday calendar.",
          "Performance ratings and comments recorded by your administrators, where your Organisation uses them.",
          "Account and security data: a securely hashed form of your password (never the password itself), sign-in times, the IP address used to sign in, and a record of changes made in the service.",
        ],
      },
      "We do not use your data for advertising, we do not sell it, and we do not build profiles of you for any purpose of our own.",
    ],
  },
  {
    id: "camera-location",
    title: "Camera and location",
    body: [
      "The service asks your browser for your location only at the moment you check in or out, and only when your Organisation requires it. It does not track you at other times or in the background.",
      "The camera is used only when photo check-in is turned on for you, and only while the check-in screen is open. The photo is linked to that day's attendance record so that your administrators can review it, and is deleted automatically after 7 days; the attendance record itself is kept. Face-capture photos are not used for automated face recognition.",
      "You can refuse camera or location access in your browser at any time; if your Organisation requires them, you may then be unable to record attendance and should speak to your administrator.",
    ],
  },
  {
    id: "purposes",
    title: "Why we process it",
    body: [
      {
        list: [
          "To record and verify attendance, including at your Organisation's office locations.",
          "To manage leave requests, balances, approvals and holidays.",
          "To keep your employee profile and emergency contact available to your Organisation's HR team.",
          "To keep the service secure: authenticating sign-ins, preventing password-guessing attacks and keeping an audit trail of changes.",
          "To operate, maintain and support the service, and to meet our legal obligations.",
        ],
      },
      "Your Organisation is responsible for having a lawful basis for its use of the service and for telling you about it, including obtaining your consent where the law requires it.",
    ],
  },
  {
    id: "access",
    title: "Who can see your data",
    body: [
      {
        list: [
          "You can see your own profile, attendance, photos and leave records.",
          "Your Organisation's administrators can see and manage the records of the people in their Organisation.",
          "Your colleagues in the same Organisation can see your directory details only: your name, profile photo, employee ID, work email, designation and department. They cannot see your personal contact details, date of birth, blood group, address, emergency contact, attendance, leave or ratings.",
          `Authorised ${L.company} staff may access data only where needed to provide, secure or support the service, under confidentiality obligations.`,
          "Service providers that host and operate our infrastructure process data on our behalf under contract.",
          "Authorities, where we are required to disclose data by law.",
        ],
      },
    ],
  },
  {
    id: "cookies",
    title: "Cookies and local storage",
    body: [
      "We use only the cookies needed for the service to work: one that keeps you signed in and one that remembers which area of the app to open for you. They are marked secure, cannot be read by scripts on the page, and expire after at most seven days. Your choice of white or black theme is stored in your browser only. We do not use advertising or tracking cookies.",
    ],
  },
  {
    id: "security",
    title: "How we protect it",
    body: [
      {
        list: [
          "All connections to the service are encrypted.",
          "Passwords are stored only as salted, one-way hashes.",
          "Access is restricted by role, enforced in the database as well as in the application, so each person can reach only the records they are permitted to see.",
          "Repeated failed sign-ins are limited to slow down password-guessing.",
          "Changes to records are logged in an audit trail that cannot be edited.",
        ],
      },
      "No system is completely secure. If a personal data breach affects you, we will inform your Organisation and the Data Protection Board of India as the DPDP Act requires.",
    ],
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: [
      `Face-capture photos from check-in and check-out are deleted automatically 7 days after they are taken. Profile photos are kept until you replace or remove them. We keep other personal data for as long as your Organisation uses the service, or for a shorter period your Organisation sets. When your Organisation's subscription ends, we delete its data within ${L.retentionAfterTermination}, unless the law requires us to keep some of it for longer. Your Organisation may ask us to delete data earlier.`,
    ],
  },
  {
    id: "rights",
    title: "Your rights",
    body: [
      "Under the DPDP Act you have the right to access a summary of your personal data, to have it corrected, completed or updated, to have it erased where it is no longer needed, to withdraw consent you have given, to nominate someone to exercise your rights if you cannot, and to have your grievances addressed.",
      "Because your employer controls your employment records, please send requests about them to your Organisation's HR team or administrator first. You can correct most profile details yourself on the Profile page. We will help your Organisation respond to your request.",
    ],
  },
  {
    id: "grievance",
    title: "Contact and grievances",
    body: [
      `For privacy questions or complaints about how we handle personal data, contact our Grievance Officer, ${L.grievanceOfficer}, at ${L.grievanceEmail}. We will acknowledge your complaint and respond within the time limits set by law.`,
      `${L.company}, ${L.address}. General privacy enquiries: ${L.email}.`,
      "If you are not satisfied with our response, you may complain to the Data Protection Board of India.",
    ],
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: [
      "We may update this policy as the service or the law changes. The date at the top shows when it last changed, and we will tell your Organisation about significant changes before they take effect.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalDocument
      eyebrow="Legal"
      title="Privacy Policy"
      updated={L.updated}
      intro={[
        "This policy explains what personal data Lasan People Pro processes when your organisation uses it, why, who can see it, and the choices and rights you have.",
      ]}
      sections={SECTIONS}
    />
  );
}
