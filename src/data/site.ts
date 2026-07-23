export const site = {
  name: 'Rodrigo Flores Bertolotti',
  title: 'Rodrigo Flores Bertolotti — AI Systems',
  description:
    'CS undergraduate at Oregon State University building production AI: a speech-to-text pipeline at Mibanco (Credicorp), LLM-reliability research at the TRUE AI Lab, and self-built tools.',
  focus:
    "CS student building production AI — a speech-to-text pipeline at Mibanco (Credicorp), LLM-reliability research at OSU's TRUE AI Lab, and tools of my own.",
  education: {
    line: 'B.S. Computer Science, Oregon State University — expected June 2028. GPA 4.0, Honors College.',
    coursework:
      'Coursework: Data Structures, Algorithms, Intro to AI, Computer Networks, Software Engineering.',
  },
  contacts: [
    { label: 'Email', value: 'rf.bertolotti@gmail.com', href: 'mailto:rf.bertolotti@gmail.com' },
    { label: 'GitHub', value: 'github.com/rfbert', href: 'https://github.com/rfbert' },
    { label: 'LinkedIn', value: 'linkedin.com/in/rodrigo-bertolotti', href: 'https://www.linkedin.com/in/rodrigo-bertolotti' },
    { label: 'Resume', value: 'resume.pdf', href: '/resume.pdf' },
  ],
  awards: [
    { title: 'Vice President, Alpha Lambda Delta National Honor Society', detail: 'OSU chapter' },
    { title: "Dean's List, College of Engineering", detail: 'Winter & Spring 2025' },
    { title: 'Diploma in Artificial Intelligence, USMP', detail: 'Final grade 98%; 100% in Fundamentals, Generative AI, and Applications (2025)' },
    { title: 'AI Fluency for Nonprofits', detail: 'Anthropic, 2026' },
    { title: 'Google: Artificial Intelligence & Productivity', detail: 'Santander Open Academy, 2026' },
    { title: 'Volunteer Organizer, community donation & food drives', detail: '65+ children and families, Peru (2023)' },
  ],
  nav: [
    { label: 'Experience', href: '/experience/' },
    { label: 'Research', href: '/research/' },
    { label: 'Projects', href: '/projects/' },
    { label: 'About', href: '/about/' },
  ],
} as const;
