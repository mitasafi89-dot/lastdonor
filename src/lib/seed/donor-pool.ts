import type { CampaignCategory } from '@/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type AgeGroup = 'young_adult' | 'adult' | 'middle_aged' | 'senior';
export type DonationBudget = 'low' | 'medium' | 'high';
export type MessageStyle = 'formal' | 'casual' | 'minimal' | 'emoji';

export type SimulatedDonor = {
  /** Stable numeric ID for cross-campaign repeat-donor tracking. */
  id: number;
  firstName: string;
  lastName: string;
  city: string;
  state: string;
  /** Metro area / region label for local clustering. */
  region: string;
  ageGroup: AgeGroup;
  /** Categories this donor is predisposed to support. */
  categoryAffinity: CampaignCategory[];
  donationBudget: DonationBudget;
  messageStyle: MessageStyle;
  /** Whether this donor has a military connection. */
  isMilitaryAdjacent: boolean;
};

// ─── Seeded PRNG (mulberry32) ───────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Demographic Data Arrays ────────────────────────────────────────────────
// Approximate US demographic proportions:
// ~58% White, ~19% Hispanic, ~13% Black, ~6% Asian, ~4% other/multiracial

// -- First names (male) by demographic group --
const MALE_NAMES_WHITE = [
  'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph',
  'Thomas', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Steven',
  'Andrew', 'Joshua', 'Kenneth', 'Kevin', 'Brian', 'Timothy', 'Ronald',
  'Jason', 'Jeffrey', 'Ryan', 'Jacob', 'Gary', 'Nicholas', 'Eric', 'Stephen',
  'Jonathan', 'Larry', 'Justin', 'Scott', 'Brandon', 'Benjamin', 'Samuel',
  'Patrick', 'Jack', 'Dennis', 'Jerry', 'Tyler', 'Aaron', 'Nathan', 'Henry',
  'Douglas', 'Peter', 'Adam', 'Zachary', 'Walter', 'Kyle', 'Harold', 'Carl',
  'Arthur', 'Gerald', 'Roger', 'Keith', 'Russell', 'Randy', 'Eugene', 'Bobby',
  'Mason', 'Liam', 'Logan', 'Ethan', 'Caleb', 'Hunter', 'Wyatt', 'Dylan',
  'Luke', 'Owen', 'Colton', 'Garrett', 'Blake', 'Brent', 'Troy', 'Grant',
];

const MALE_NAMES_HISPANIC = [
  'Carlos', 'Miguel', 'Luis', 'Jose', 'Diego', 'Alejandro', 'Ricardo',
  'Fernando', 'Oscar', 'Javier', 'Marco', 'Rafael', 'Eduardo', 'Sergio',
  'Gabriel', 'Andres', 'Pedro', 'Juan', 'Pablo', 'Hector', 'Raul', 'Ernesto',
  'Mario', 'Roberto', 'Arturo', 'Francisco', 'Enrique', 'Angel', 'Hugo',
  'Ruben', 'Tomas', 'Santiago', 'Mateo', 'Sebastian', 'Ivan', 'Cesar',
];

const MALE_NAMES_BLACK = [
  'DeShawn', 'Jamal', 'Tyrone', 'Marcus', 'Darnell', 'Andre', 'Terrence',
  'Lamar', 'Malik', 'Jerome', 'Darius', 'Antoine', 'Xavier', 'Cedric',
  'Dante', 'Rashad', 'Isaiah', 'Elijah', 'Jaylen', 'Marquis', 'Wendell',
  'Desmond', 'Khalil', 'Kareem', 'Damien', 'Jermaine', 'Tyrell', 'Corey',
  'Calvin', 'Leon', 'Rodney', 'Kenny', 'Devin', 'Donnell', 'Curtis',
];

const MALE_NAMES_ASIAN = [
  'Wei', 'Hiroshi', 'Raj', 'Jin', 'Amit', 'Kenji', 'Sanjay', 'Min',
  'Tran', 'Chen', 'Vikram', 'Arun', 'Yusuf', 'Kiran', 'Hiro', 'Ravi',
  'Akira', 'Deepak', 'Sunil', 'Feng', 'Bao', 'Duc', 'Kai', 'Leo',
  'Nikhil', 'Arjun', 'Pranav', 'Rohan', 'Samir', 'Tariq',
];

// -- First names (female) by demographic group --
const FEMALE_NAMES_WHITE = [
  'Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan',
  'Jessica', 'Sarah', 'Karen', 'Lisa', 'Nancy', 'Betty', 'Margaret', 'Sandra',
  'Ashley', 'Dorothy', 'Kimberly', 'Emily', 'Donna', 'Michelle', 'Carol',
  'Amanda', 'Melissa', 'Deborah', 'Stephanie', 'Rebecca', 'Sharon', 'Laura',
  'Cynthia', 'Kathleen', 'Amy', 'Angela', 'Shirley', 'Anna', 'Brenda',
  'Pamela', 'Nicole', 'Samantha', 'Katherine', 'Christine', 'Debra', 'Rachel',
  'Carolyn', 'Janet', 'Catherine', 'Maria', 'Heather', 'Diane', 'Ruth',
  'Julie', 'Olivia', 'Joyce', 'Virginia', 'Victoria', 'Kelly', 'Lauren',
  'Christina', 'Joan', 'Evelyn', 'Judith', 'Megan', 'Andrea', 'Cheryl',
  'Hannah', 'Jacqueline', 'Martha', 'Gloria', 'Teresa', 'Ann', 'Sara',
  'Madison', 'Frances', 'Kathryn', 'Janice', 'Jean', 'Abigail', 'Alice',
  'Judy', 'Sophia', 'Grace', 'Denise', 'Amber', 'Doris', 'Marilyn',
  'Danielle', 'Beverly', 'Isabella', 'Theresa', 'Diana', 'Natalie', 'Brittany',
  'Charlotte', 'Marie', 'Kayla', 'Alexis', 'Lori', 'Paige', 'Brooke',
];

const FEMALE_NAMES_HISPANIC = [
  'Maria', 'Sofia', 'Isabella', 'Valentina', 'Gabriela', 'Carmen', 'Elena',
  'Ana', 'Lucia', 'Rosa', 'Guadalupe', 'Alejandra', 'Mariana', 'Catalina',
  'Fernanda', 'Adriana', 'Daniela', 'Patricia', 'Veronica', 'Marina',
  'Natalia', 'Teresa', 'Claudia', 'Diana', 'Paola', 'Carolina', 'Leticia',
  'Gloria', 'Silvia', 'Marisol', 'Esperanza', 'Alicia', 'Yolanda', 'Bianca',
];

const FEMALE_NAMES_BLACK = [
  'Aaliyah', 'Keisha', 'Imani', 'Tasha', 'Ebony', 'Jasmine', 'Destiny',
  'Brianna', 'Diamond', 'Shaniqua', 'Tamika', 'Latoya', 'Monique', 'Tiffany',
  'Crystal', 'Dominique', 'Shawna', 'Keyana', 'Aliyah', 'Ciara', 'Janelle',
  'Jazmine', 'Chelsea', 'Kennedy', 'Asia', 'Miracle', 'Nyla', 'Naomi',
  'Trinity', 'Simone', 'Adrienne', 'Candice', 'Breanna', 'Chanel', 'Tierra',
];

const FEMALE_NAMES_ASIAN = [
  'Priya', 'Mei-Lin', 'Yuki', 'Sunita', 'Deepa', 'Sakura', 'Padma',
  'Nisha', 'Linh', 'Anh', 'Fatima', 'Ayumi', 'Rina', 'Mina', 'Kavita',
  'Ananya', 'Pooja', 'Shreya', 'Haruka', 'Mei', 'Xiu', 'Hana', 'Noor',
  'Zara', 'Amara', 'Leila', 'Sana', 'Riya', 'Diya', 'Maya',
];

// -- Last names by demographic group --
const LAST_NAMES_WHITE = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Davis', 'Miller',
  'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White',
  'Harris', 'Martin', 'Thompson', 'Garcia', 'Robinson', 'Clark', 'Lewis',
  'Walker', 'Hall', 'Allen', 'Young', 'King', 'Wright', 'Scott', 'Green',
  'Baker', 'Adams', 'Nelson', 'Hill', 'Campbell', 'Mitchell', 'Roberts',
  'Carter', 'Phillips', 'Evans', 'Turner', 'Torres', 'Parker', 'Collins',
  'Edwards', 'Stewart', 'Morris', 'Murphy', 'Cook', 'Rogers', 'Morgan',
  'Cooper', 'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Sanders',
  'Bennett', 'Wood', 'Barnes', 'Ross', 'Henderson', 'Coleman', 'Jenkins',
  'Perry', 'Powell', 'Long', 'Patterson', 'Hughes', 'Price', 'Foster',
  'Butler', 'Simmons', 'Bryant', 'Russell', 'Griffin', 'Hayes', 'Myers',
  'Ford', 'Hamilton', 'Graham', 'Sullivan', 'Wallace', 'Woods', 'West',
  'Cole', 'Owens', 'Reynolds', 'Fisher', 'Ellis', 'Harrison', 'Gibson',
  'McDonald', 'Cruz', 'Marshall', 'Olson', 'Hansen', 'Schmidt', 'Larson',
  'Peterson', 'Carlson', 'Swanson', 'Lindstrom', 'O\'Brien', 'McCarthy',
];
const LAST_NAMES_HISPANIC = [
  'Garcia', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
  'Perez', 'Sanchez', 'Ramirez', 'Torres', 'Flores', 'Rivera', 'Gomez',
  'Diaz', 'Reyes', 'Morales', 'Cruz', 'Ortiz', 'Gutierrez', 'Chavez',
  'Ramos', 'Vargas', 'Castillo', 'Jimenez', 'Moreno', 'Romero', 'Herrera',
  'Medina', 'Aguilar', 'Castro', 'Ruiz', 'Mendoza', 'Vasquez', 'Salazar',
  'Delgado', 'Soto', 'Guerrero', 'Espinoza', 'Contreras', 'Sandoval',
  'Fuentes', 'Cervantes', 'Leon', 'Mejia', 'Rios', 'Cardenas', 'Estrada',
  'Luna', 'Molina', 'Acosta',
];
const LAST_NAMES_BLACK = [
  'Washington', 'Jefferson', 'Franklin', 'Jackson', 'Robinson', 'Williams',
  'Johnson', 'Brown', 'Harris', 'Coleman', 'Jenkins', 'Patterson', 'Simmons',
  'Bryant', 'Griffin', 'Hayes', 'Banks', 'Brooks', 'Freeman', 'Lawson',
  'Dixon', 'Grant', 'Hampton', 'Marshall', 'Richardson', 'Willis', 'Barber',
  'Booker', 'Tucker', 'Porter', 'Carter', 'Douglas', 'Price', 'Hicks',
  'Chambers', 'Watkins', 'Mack', 'Pope', 'Singleton', 'Farmer',
];
const LAST_NAMES_ASIAN = [
  'Wang', 'Li', 'Zhang', 'Chen', 'Liu', 'Kim', 'Lee', 'Park', 'Patel',
  'Singh', 'Nguyen', 'Tran', 'Shah', 'Kumar', 'Gupta', 'Sharma', 'Tanaka',
  'Suzuki', 'Yamamoto', 'Nakamura', 'Wu', 'Yang', 'Huang', 'Choi', 'Chang',
  'Lin', 'Lim', 'Das', 'Rao', 'Iyer', 'Mehta', 'Reddy', 'Joshi', 'Mishra',
  'Ahmad', 'Rahman', 'Hasan', 'Kaur', 'Bhat', 'Agarwal',
];

// -- Geographic data: city, state, region (metro area) --
type GeoEntry = { city: string; state: string; region: string };

const GEO_ENTRIES: GeoEntry[] = [
  // ── Northeast ──
  { city: 'New York', state: 'NY', region: 'New York Metro' },
  { city: 'Brooklyn', state: 'NY', region: 'New York Metro' },
  { city: 'Queens', state: 'NY', region: 'New York Metro' },
  { city: 'Bronx', state: 'NY', region: 'New York Metro' },
  { city: 'Yonkers', state: 'NY', region: 'New York Metro' },
  { city: 'Jersey City', state: 'NJ', region: 'New York Metro' },
  { city: 'Newark', state: 'NJ', region: 'New York Metro' },
  { city: 'Buffalo', state: 'NY', region: 'Buffalo Metro' },
  { city: 'Rochester', state: 'NY', region: 'Rochester Metro' },
  { city: 'Syracuse', state: 'NY', region: 'Syracuse Metro' },
  { city: 'Albany', state: 'NY', region: 'Albany Metro' },
  { city: 'Boston', state: 'MA', region: 'Boston Metro' },
  { city: 'Cambridge', state: 'MA', region: 'Boston Metro' },
  { city: 'Worcester', state: 'MA', region: 'Boston Metro' },
  { city: 'Springfield', state: 'MA', region: 'Springfield Metro' },
  { city: 'Philadelphia', state: 'PA', region: 'Philadelphia Metro' },
  { city: 'Pittsburgh', state: 'PA', region: 'Pittsburgh Metro' },
  { city: 'Allentown', state: 'PA', region: 'Lehigh Valley' },
  { city: 'Scranton', state: 'PA', region: 'Scranton Metro' },
  { city: 'Lancaster', state: 'PA', region: 'Lancaster Metro' },
  { city: 'Harrisburg', state: 'PA', region: 'Harrisburg Metro' },
  { city: 'Hartford', state: 'CT', region: 'Hartford Metro' },
  { city: 'New Haven', state: 'CT', region: 'New Haven Metro' },
  { city: 'Stamford', state: 'CT', region: 'New York Metro' },
  { city: 'Providence', state: 'RI', region: 'Providence Metro' },
  { city: 'Portland', state: 'ME', region: 'Portland ME Metro' },
  { city: 'Manchester', state: 'NH', region: 'Manchester Metro' },
  { city: 'Burlington', state: 'VT', region: 'Burlington Metro' },
  { city: 'Trenton', state: 'NJ', region: 'Trenton Metro' },
  { city: 'Wilmington', state: 'DE', region: 'Philadelphia Metro' },
  // ── Southeast ──
  { city: 'Washington', state: 'DC', region: 'DC Metro' },
  { city: 'Baltimore', state: 'MD', region: 'Baltimore Metro' },
  { city: 'Annapolis', state: 'MD', region: 'DC Metro' },
  { city: 'Virginia Beach', state: 'VA', region: 'Hampton Roads' },
  { city: 'Norfolk', state: 'VA', region: 'Hampton Roads' },
  { city: 'Richmond', state: 'VA', region: 'Richmond Metro' },
  { city: 'Arlington', state: 'VA', region: 'DC Metro' },
  { city: 'Charlotte', state: 'NC', region: 'Charlotte Metro' },
  { city: 'Raleigh', state: 'NC', region: 'Raleigh-Durham' },
  { city: 'Durham', state: 'NC', region: 'Raleigh-Durham' },
  { city: 'Greensboro', state: 'NC', region: 'Piedmont Triad' },
  { city: 'Fayetteville', state: 'NC', region: 'Fayetteville Metro' },
  { city: 'Jacksonville', state: 'NC', region: 'Jacksonville NC Metro' },
  { city: 'Charleston', state: 'SC', region: 'Charleston Metro' },
  { city: 'Columbia', state: 'SC', region: 'Columbia SC Metro' },
  { city: 'Greenville', state: 'SC', region: 'Greenville Metro' },
  { city: 'Atlanta', state: 'GA', region: 'Atlanta Metro' },
  { city: 'Savannah', state: 'GA', region: 'Savannah Metro' },
  { city: 'Augusta', state: 'GA', region: 'Augusta Metro' },
  { city: 'Jacksonville', state: 'FL', region: 'Jacksonville FL Metro' },
  { city: 'Miami', state: 'FL', region: 'Miami Metro' },
  { city: 'Tampa', state: 'FL', region: 'Tampa Bay' },
  { city: 'Orlando', state: 'FL', region: 'Orlando Metro' },
  { city: 'Fort Lauderdale', state: 'FL', region: 'Miami Metro' },
  { city: 'St. Petersburg', state: 'FL', region: 'Tampa Bay' },
  { city: 'Pensacola', state: 'FL', region: 'Pensacola Metro' },
  { city: 'Tallahassee', state: 'FL', region: 'Tallahassee Metro' },
  { city: 'Gainesville', state: 'FL', region: 'Gainesville Metro' },
  { city: 'Nashville', state: 'TN', region: 'Nashville Metro' },
  { city: 'Memphis', state: 'TN', region: 'Memphis Metro' },
  { city: 'Knoxville', state: 'TN', region: 'Knoxville Metro' },
  { city: 'Chattanooga', state: 'TN', region: 'Chattanooga Metro' },
  { city: 'Clarksville', state: 'TN', region: 'Clarksville Metro' },
  { city: 'Birmingham', state: 'AL', region: 'Birmingham Metro' },
  { city: 'Huntsville', state: 'AL', region: 'Huntsville Metro' },
  { city: 'Montgomery', state: 'AL', region: 'Montgomery Metro' },
  { city: 'Mobile', state: 'AL', region: 'Mobile Metro' },
  { city: 'New Orleans', state: 'LA', region: 'New Orleans Metro' },
  { city: 'Baton Rouge', state: 'LA', region: 'Baton Rouge Metro' },
  { city: 'Shreveport', state: 'LA', region: 'Shreveport Metro' },
  { city: 'Jackson', state: 'MS', region: 'Jackson MS Metro' },
  { city: 'Louisville', state: 'KY', region: 'Louisville Metro' },
  { city: 'Lexington', state: 'KY', region: 'Lexington Metro' },
  { city: 'Charleston', state: 'WV', region: 'Charleston WV Metro' },
  // ── Midwest ──
  { city: 'Chicago', state: 'IL', region: 'Chicago Metro' },
  { city: 'Springfield', state: 'IL', region: 'Springfield IL Metro' },
  { city: 'Peoria', state: 'IL', region: 'Peoria Metro' },
  { city: 'Detroit', state: 'MI', region: 'Detroit Metro' },
  { city: 'Grand Rapids', state: 'MI', region: 'Grand Rapids Metro' },
  { city: 'Lansing', state: 'MI', region: 'Lansing Metro' },
  { city: 'Ann Arbor', state: 'MI', region: 'Detroit Metro' },
  { city: 'Dearborn', state: 'MI', region: 'Detroit Metro' },
  { city: 'Cleveland', state: 'OH', region: 'Cleveland Metro' },
  { city: 'Columbus', state: 'OH', region: 'Columbus Metro' },
  { city: 'Cincinnati', state: 'OH', region: 'Cincinnati Metro' },
  { city: 'Dayton', state: 'OH', region: 'Dayton Metro' },
  { city: 'Indianapolis', state: 'IN', region: 'Indianapolis Metro' },
  { city: 'Fort Wayne', state: 'IN', region: 'Fort Wayne Metro' },
  { city: 'Evansville', state: 'IN', region: 'Evansville Metro' },
  { city: 'Milwaukee', state: 'WI', region: 'Milwaukee Metro' },
  { city: 'Madison', state: 'WI', region: 'Madison Metro' },
  { city: 'Green Bay', state: 'WI', region: 'Green Bay Metro' },
  { city: 'Minneapolis', state: 'MN', region: 'Twin Cities' },
  { city: 'St. Paul', state: 'MN', region: 'Twin Cities' },
  { city: 'Duluth', state: 'MN', region: 'Duluth Metro' },
  { city: 'Des Moines', state: 'IA', region: 'Des Moines Metro' },
  { city: 'Cedar Rapids', state: 'IA', region: 'Cedar Rapids Metro' },
  { city: 'Davenport', state: 'IA', region: 'Quad Cities' },
  { city: 'Kansas City', state: 'MO', region: 'Kansas City Metro' },
  { city: 'St. Louis', state: 'MO', region: 'St. Louis Metro' },
  { city: 'Springfield', state: 'MO', region: 'Springfield MO Metro' },
  { city: 'Omaha', state: 'NE', region: 'Omaha Metro' },
  { city: 'Lincoln', state: 'NE', region: 'Lincoln Metro' },
  { city: 'Wichita', state: 'KS', region: 'Wichita Metro' },
  { city: 'Topeka', state: 'KS', region: 'Topeka Metro' },
  { city: 'Sioux Falls', state: 'SD', region: 'Sioux Falls Metro' },
  { city: 'Fargo', state: 'ND', region: 'Fargo Metro' },
  { city: 'Bismarck', state: 'ND', region: 'Bismarck Metro' },
  // ── Southwest ──
  { city: 'Dallas', state: 'TX', region: 'Dallas-Fort Worth' },
  { city: 'Fort Worth', state: 'TX', region: 'Dallas-Fort Worth' },
  { city: 'Houston', state: 'TX', region: 'Houston Metro' },
  { city: 'San Antonio', state: 'TX', region: 'San Antonio Metro' },
  { city: 'Austin', state: 'TX', region: 'Austin Metro' },
  { city: 'El Paso', state: 'TX', region: 'El Paso Metro' },
  { city: 'Corpus Christi', state: 'TX', region: 'Corpus Christi Metro' },
  { city: 'Lubbock', state: 'TX', region: 'Lubbock Metro' },
  { city: 'Amarillo', state: 'TX', region: 'Amarillo Metro' },
  { city: 'Killeen', state: 'TX', region: 'Killeen Metro' },
  { city: 'Waco', state: 'TX', region: 'Waco Metro' },
  { city: 'Midland', state: 'TX', region: 'Midland Metro' },
  { city: 'Phoenix', state: 'AZ', region: 'Phoenix Metro' },
  { city: 'Tucson', state: 'AZ', region: 'Tucson Metro' },
  { city: 'Mesa', state: 'AZ', region: 'Phoenix Metro' },
  { city: 'Albuquerque', state: 'NM', region: 'Albuquerque Metro' },
  { city: 'Santa Fe', state: 'NM', region: 'Santa Fe Metro' },
  { city: 'Las Vegas', state: 'NV', region: 'Las Vegas Metro' },
  { city: 'Reno', state: 'NV', region: 'Reno Metro' },
  { city: 'Oklahoma City', state: 'OK', region: 'Oklahoma City Metro' },
  { city: 'Tulsa', state: 'OK', region: 'Tulsa Metro' },
  // ── West ──
  { city: 'Los Angeles', state: 'CA', region: 'Los Angeles Metro' },
  { city: 'San Francisco', state: 'CA', region: 'Bay Area' },
  { city: 'San Diego', state: 'CA', region: 'San Diego Metro' },
  { city: 'San Jose', state: 'CA', region: 'Bay Area' },
  { city: 'Sacramento', state: 'CA', region: 'Sacramento Metro' },
  { city: 'Fresno', state: 'CA', region: 'Central Valley' },
  { city: 'Oakland', state: 'CA', region: 'Bay Area' },
  { city: 'Riverside', state: 'CA', region: 'Inland Empire' },
  { city: 'Bakersfield', state: 'CA', region: 'Central Valley' },
  { city: 'Fremont', state: 'CA', region: 'Bay Area' },
  { city: 'Oceanside', state: 'CA', region: 'San Diego Metro' },
  { city: 'Westminster', state: 'CA', region: 'Los Angeles Metro' },
  { city: 'Seattle', state: 'WA', region: 'Seattle Metro' },
  { city: 'Tacoma', state: 'WA', region: 'Seattle Metro' },
  { city: 'Spokane', state: 'WA', region: 'Spokane Metro' },
  { city: 'Olympia', state: 'WA', region: 'Olympia Metro' },
  { city: 'Portland', state: 'OR', region: 'Portland OR Metro' },
  { city: 'Eugene', state: 'OR', region: 'Eugene Metro' },
  { city: 'Salem', state: 'OR', region: 'Salem Metro' },
  { city: 'Denver', state: 'CO', region: 'Denver Metro' },
  { city: 'Colorado Springs', state: 'CO', region: 'Colorado Springs Metro' },
  { city: 'Fort Collins', state: 'CO', region: 'Fort Collins Metro' },
  { city: 'Boulder', state: 'CO', region: 'Denver Metro' },
  { city: 'Salt Lake City', state: 'UT', region: 'Salt Lake Metro' },
  { city: 'Boise', state: 'ID', region: 'Boise Metro' },
  { city: 'Honolulu', state: 'HI', region: 'Honolulu Metro' },
  { city: 'Anchorage', state: 'AK', region: 'Anchorage Metro' },
  { city: 'Bozeman', state: 'MT', region: 'Bozeman Metro' },
  { city: 'Missoula', state: 'MT', region: 'Missoula Metro' },
  { city: 'Helena', state: 'MT', region: 'Helena Metro' },
  { city: 'Cheyenne', state: 'WY', region: 'Cheyenne Metro' },
];

// Military-adjacent cities (used for isMilitaryAdjacent tagging)
const MILITARY_CITIES = new Set([
  'Fayetteville', 'Norfolk', 'Virginia Beach', 'San Antonio', 'Killeen',
  'Oceanside', 'Jacksonville', 'Tacoma', 'Colorado Springs', 'Clarksville',
  'Pensacola', 'Honolulu', 'Fort Worth', 'Hampton', 'Columbia',
]);

// ─── Category Affinity Assignment ───────────────────────────────────────────

const ALL_CATEGORIES: CampaignCategory[] = [
  'medical', 'disaster', 'military', 'veterans', 'memorial', 'first-responders',
  'community', 'essential-needs', 'emergency', 'charity', 'education', 'animal',
  'environment', 'business', 'competition', 'creative', 'event', 'faith',
  'family', 'sports', 'travel', 'volunteer', 'wishes',
];

/** Pick 2-5 random category affinities, weighted by age/demographic heuristics. */
function pickAffinities(
  rand: () => number,
  ageGroup: AgeGroup,
  isMilitary: boolean,
): CampaignCategory[] {
  const count = 2 + Math.floor(rand() * 4); // 2-5
  const pool = [...ALL_CATEGORIES];

  // Military donors always have military/veterans affinity
  const result: CampaignCategory[] = [];
  if (isMilitary) {
    result.push('military', 'veterans');
  }

  // Age-weighted preferences
  const ageWeights: Partial<Record<CampaignCategory, number>> =
    ageGroup === 'senior'
      ? { memorial: 3, faith: 3, charity: 2, medical: 2, community: 2 }
      : ageGroup === 'young_adult'
        ? { education: 3, creative: 3, animal: 2, environment: 2, sports: 2 }
        : ageGroup === 'middle_aged'
          ? { medical: 2, family: 3, education: 2, community: 2, faith: 2 }
          : { community: 2, charity: 2, medical: 2, disaster: 2 }; // adult

  // Weighted sampling without replacement
  while (result.length < count && pool.length > 0) {
    const weights = pool.map((c) => (ageWeights[c] ?? 1));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rand() * total;
    let idx = 0;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) { idx = i; break; }
    }
    const picked = pool.splice(idx, 1)[0];
    if (!result.includes(picked)) {
      result.push(picked);
    }
  }

  return result;
}

// ─── Pool Generation ────────────────────────────────────────────────────────

const POOL_SIZE = 3200;

/** Demographic slot distribution (approximate US census proportions). */
type DemoSlot = 'white_m' | 'white_f' | 'hispanic_m' | 'hispanic_f' | 'black_m' | 'black_f' | 'asian_m' | 'asian_f';

const DEMO_WEIGHTS: [DemoSlot, number][] = [
  ['white_m', 0.29],
  ['white_f', 0.29],
  ['hispanic_m', 0.095],
  ['hispanic_f', 0.095],
  ['black_m', 0.065],
  ['black_f', 0.065],
  ['asian_m', 0.03],
  ['asian_f', 0.03],
];

function getNameArrays(slot: DemoSlot): { firstNames: string[]; lastNames: string[] } {
  switch (slot) {
    case 'white_m': return { firstNames: MALE_NAMES_WHITE, lastNames: LAST_NAMES_WHITE };
    case 'white_f': return { firstNames: FEMALE_NAMES_WHITE, lastNames: LAST_NAMES_WHITE };
    case 'hispanic_m': return { firstNames: MALE_NAMES_HISPANIC, lastNames: LAST_NAMES_HISPANIC };
    case 'hispanic_f': return { firstNames: FEMALE_NAMES_HISPANIC, lastNames: LAST_NAMES_HISPANIC };
    case 'black_m': return { firstNames: MALE_NAMES_BLACK, lastNames: LAST_NAMES_BLACK };
    case 'black_f': return { firstNames: FEMALE_NAMES_BLACK, lastNames: LAST_NAMES_BLACK };
    case 'asian_m': return { firstNames: MALE_NAMES_ASIAN, lastNames: LAST_NAMES_ASIAN };
    case 'asian_f': return { firstNames: FEMALE_NAMES_ASIAN, lastNames: LAST_NAMES_ASIAN };
  }
}

function pickDemoSlot(rand: () => number): DemoSlot {
  let r = rand();
  for (const [slot, weight] of DEMO_WEIGHTS) {
    r -= weight;
    if (r <= 0) return slot;
  }
  return DEMO_WEIGHTS[DEMO_WEIGHTS.length - 1][0];
}

function pickAgeGroup(rand: () => number): AgeGroup {
  const r = rand();
  if (r < 0.18) return 'young_adult';   // 18-29
  if (r < 0.50) return 'adult';         // 30-44
  if (r < 0.78) return 'middle_aged';   // 45-59
  return 'senior';                       // 60+
}

function pickBudget(rand: () => number, ageGroup: AgeGroup): DonationBudget {
  const r = rand();
  if (ageGroup === 'young_adult') {
    if (r < 0.60) return 'low';
    if (r < 0.90) return 'medium';
    return 'high';
  }
  if (ageGroup === 'senior') {
    if (r < 0.25) return 'low';
    if (r < 0.65) return 'medium';
    return 'high';
  }
  // adult, middle_aged
  if (r < 0.35) return 'low';
  if (r < 0.75) return 'medium';
  return 'high';
}

function pickMessageStyle(rand: () => number, ageGroup: AgeGroup): MessageStyle {
  const r = rand();
  if (ageGroup === 'young_adult') {
    if (r < 0.15) return 'formal';
    if (r < 0.45) return 'casual';
    if (r < 0.70) return 'minimal';
    return 'emoji';
  }
  if (ageGroup === 'senior') {
    if (r < 0.40) return 'formal';
    if (r < 0.70) return 'casual';
    if (r < 0.90) return 'minimal';
    return 'emoji';
  }
  // adult, middle_aged
  if (r < 0.25) return 'formal';
  if (r < 0.55) return 'casual';
  if (r < 0.80) return 'minimal';
  return 'emoji';
}

function generatePool(): SimulatedDonor[] {
  const rand = mulberry32(0x4c41_5354); // deterministic seed
  const pool: SimulatedDonor[] = [];
  const usedCombos = new Set<string>();

  for (let i = 0; i < POOL_SIZE; i++) {
    const slot = pickDemoSlot(rand);
    const { firstNames, lastNames } = getNameArrays(slot);

    let firstName: string;
    let lastName: string;
    let geo: GeoEntry;
    let combo: string;

    // Ensure unique first+last+city combinations
    let attempts = 0;
    do {
      firstName = firstNames[Math.floor(rand() * firstNames.length)];
      lastName = lastNames[Math.floor(rand() * lastNames.length)];
      geo = GEO_ENTRIES[Math.floor(rand() * GEO_ENTRIES.length)];
      combo = `${firstName}|${lastName}|${geo.city}|${geo.state}`;
      attempts++;
    } while (usedCombos.has(combo) && attempts < 20);

    usedCombos.add(combo);

    const ageGroup = pickAgeGroup(rand);
    const isMilitary = MILITARY_CITIES.has(geo.city) && rand() < 0.35;

    pool.push({
      id: i,
      firstName,
      lastName,
      city: geo.city,
      state: geo.state,
      region: geo.region,
      ageGroup,
      categoryAffinity: pickAffinities(rand, ageGroup, isMilitary),
      donationBudget: pickBudget(rand, ageGroup),
      messageStyle: pickMessageStyle(rand, ageGroup),
      isMilitaryAdjacent: isMilitary,
    });
  }

  return pool;
}

// ─── Exported Pool & Indexes ────────────────────────────────────────────────

/** The full pool of 3,200 simulated donors, generated deterministically. */
export const DONOR_POOL: readonly SimulatedDonor[] = generatePool();

export const DONOR_POOL_SIZE = DONOR_POOL.length;

/** Index: state → donor IDs in that state. */
export const DONORS_BY_STATE: ReadonlyMap<string, number[]> = (() => {
  const map = new Map<string, number[]>();
  for (const d of DONOR_POOL) {
    const arr = map.get(d.state) ?? [];
    arr.push(d.id);
    map.set(d.state, arr);
  }
  return map;
})();

/** Index: region → donor IDs in that metro area. */
export const DONORS_BY_REGION: ReadonlyMap<string, number[]> = (() => {
  const map = new Map<string, number[]>();
  for (const d of DONOR_POOL) {
    const arr = map.get(d.region) ?? [];
    arr.push(d.id);
    map.set(d.region, arr);
  }
  return map;
})();

/** Index: city+state → donor IDs in that exact city. */
export const DONORS_BY_CITY: ReadonlyMap<string, number[]> = (() => {
  const map = new Map<string, number[]>();
  for (const d of DONOR_POOL) {
    const key = `${d.city}, ${d.state}`;
    const arr = map.get(key) ?? [];
    arr.push(d.id);
    map.set(key, arr);
  }
  return map;
})();

/** Index: last name → donor IDs with that surname (for family chains). */
export const DONORS_BY_LAST_NAME: ReadonlyMap<string, number[]> = (() => {
  const map = new Map<string, number[]>();
  for (const d of DONOR_POOL) {
    const arr = map.get(d.lastName) ?? [];
    arr.push(d.id);
    map.set(d.lastName, arr);
  }
  return map;
})();

/** All military-adjacent donor IDs. */
export const MILITARY_DONOR_IDS: readonly number[] =
  DONOR_POOL.filter((d) => d.isMilitaryAdjacent).map((d) => d.id);
