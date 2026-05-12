// ═══════════════════════════════════════════════════════════
// courses.js  —  Single source of truth for all UniMatch courses
// Import in groups.js and group.js
// ═══════════════════════════════════════════════════════════

export const COURSE_CATALOGUE = [
  {
    category: "🧠 Arts, Humanities & Social Sciences",
    courses: [
      "Philosophy", "History", "Archaeology", "Anthropology", "Sociology",
      "Psychology", "Political Science", "International Relations", "Economics",
      "Development Studies", "Geography", "Linguistics", "English Literature",
      "Comparative Literature", "Creative Writing", "Journalism",
      "Mass Communication", "Media Studies", "Film Studies", "Theatre Arts",
      "Music", "Fine Arts", "Performing Arts", "Religious Studies", "Cultural Studies"
    ]
  },
  {
    category: "📊 Business, Management & Economics",
    courses: [
      "Business Administration", "Commerce", "Accounting", "Finance", "Economics",
      "Banking & Finance", "Marketing", "Human Resource Management",
      "Entrepreneurship", "International Business", "Supply Chain Management",
      "Procurement & Logistics", "Project Management", "Actuarial Science",
      "Insurance", "Business Analytics", "Public Administration"
    ]
  },
  {
    category: "💻 Computing, IT & Data",
    courses: [
      "Computer Science", "Information Technology (IT)", "Software Engineering",
      "Computer Engineering", "Data Science", "Artificial Intelligence",
      "Machine Learning", "Cybersecurity", "Information Systems",
      "Computer Networks", "Web Development", "Game Development",
      "Cloud Computing", "Robotics", "Bioinformatics"
    ]
  },
  {
    category: "🧮 Natural & Physical Sciences",
    courses: [
      "Mathematics", "Applied Mathematics", "Statistics", "Physics",
      "Applied Physics", "Chemistry", "Biochemistry", "Environmental Science",
      "Environmental Studies", "Geology", "Earth Science", "Astronomy",
      "Astrophysics", "Meteorology", "Oceanography"
    ]
  },
  {
    category: "🧬 Biological & Life Sciences",
    courses: [
      "Biology", "Microbiology", "Biotechnology", "Genetics", "Molecular Biology",
      "Zoology", "Botany", "Ecology", "Marine Biology", "Biochemistry",
      "Biomedical Science", "Food Science & Technology"
    ]
  },
  {
    category: "🏥 Medicine, Health & Life Care",
    courses: [
      "Medicine (MBChB / MD)", "Nursing", "Pharmacy", "Dentistry",
      "Clinical Medicine", "Public Health", "Environmental Health",
      "Nutrition & Dietetics", "Medical Laboratory Science", "Physiotherapy",
      "Radiography", "Occupational Therapy",
      "Health Records & Information Management", "Biomedical Engineering"
    ]
  },
  {
    category: "⚙️ Engineering & Technology",
    courses: [
      "Civil Engineering", "Mechanical Engineering", "Electrical Engineering",
      "Electronic Engineering", "Mechatronics Engineering", "Chemical Engineering",
      "Petroleum Engineering", "Mining Engineering", "Industrial Engineering",
      "Agricultural Engineering", "Automotive Engineering", "Aerospace Engineering",
      "Structural Engineering", "Renewable Energy Engineering"
    ]
  },
  {
    category: "🌱 Agriculture, Environment & Natural Resources",
    courses: [
      "Agriculture", "Agribusiness", "Agricultural Economics", "Crop Science",
      "Animal Science", "Horticulture", "Soil Science", "Forestry",
      "Wildlife Management", "Fisheries & Aquaculture",
      "Environmental Management", "Natural Resource Management"
    ]
  },
  {
    category: "⚖️ Law, Governance & Security",
    courses: [
      "Law (LLB)", "Criminology", "Criminal Justice", "Forensic Science",
      "International Law", "Human Rights", "Diplomacy", "Public Policy",
      "Governance", "Security Studies", "Peace & Conflict Studies"
    ]
  },
  {
    category: "🏗️ Built Environment, Design & Planning",
    courses: [
      "Architecture", "Quantity Surveying", "Construction Management",
      "Urban & Regional Planning", "Real Estate Management", "Interior Design",
      "Landscape Architecture", "Geomatic Engineering (Surveying)"
    ]
  },
  {
    category: "🎓 Education & Teaching",
    courses: [
      "Education (Arts / Science)", "Curriculum Studies", "Educational Psychology",
      "Early Childhood Education", "Special Needs Education",
      "Educational Technology", "Guidance & Counselling", "Physical Education"
    ]
  },
  {
    category: "🏨 Hospitality, Tourism & Leisure",
    courses: [
      "Hospitality Management", "Tourism Management", "Hotel Management",
      "Travel & Tour Operations", "Event Management", "Culinary Arts"
    ]
  }
];

// Flat list of every course (for search, feed filters etc.)
export const ALL_COURSES = COURSE_CATALOGUE.flatMap(c => c.courses);