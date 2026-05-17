import pg from "pg";

const { Pool } = pg;

const dbUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
if (!dbUrl) throw new Error("No DB URL found");

const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.default.hash(password, 10);
}

async function seed() {
  const client = await pool.connect();
  console.log("Connected to database. Seeding...");

  try {
    // Admin user
    const adminHash = await hashPassword("admin123");
    await client.query(`
      INSERT INTO users (username, password, role, name, email)
      VALUES ('admin', $1, 'admin', 'School Administrator', 'admin@kips.edu.pk')
      ON CONFLICT (username) DO UPDATE SET password = $1
    `, [adminHash]);
    console.log("✓ Admin user (admin / admin123)");

    // Classes
    const existing = await client.query("SELECT count(*) as cnt FROM classes");
    if (Number(existing.rows[0].cnt) === 0) {
      await client.query(`
        INSERT INTO classes (name, grade, sections) VALUES
          ('Nursery', 'Nursery', 'A,B'),
          ('KG', 'KG', 'A,B'),
          ('Class 1', 'Grade 1', 'A,B,C'),
          ('Class 2', 'Grade 2', 'A,B,C'),
          ('Class 3', 'Grade 3', 'A,B'),
          ('Class 4', 'Grade 4', 'A,B'),
          ('Class 5', 'Grade 5', 'A,B'),
          ('Class 6', 'Grade 6', 'A,B'),
          ('Class 7', 'Grade 7', 'A,B'),
          ('Class 8', 'Grade 8', 'A,B'),
          ('Class 9', 'Grade 9', 'A,B'),
          ('Class 10', 'Grade 10', 'A,B')
      `);
      console.log("✓ 12 classes seeded");
    } else {
      console.log("✓ Classes already exist, skipping");
    }

    const classRows = await client.query("SELECT id, name FROM classes ORDER BY id");
    const classMap: Record<string, number> = {};
    for (const r of classRows.rows) classMap[r.name] = r.id;

    // --- REAL STAFF from KIPS School Hassari ---
    // Clear old mock staff and re-seed with real data
    await client.query(`DELETE FROM staff WHERE username LIKE '%.staff'`);
    await client.query(`DELETE FROM users WHERE role = 'teacher' AND username LIKE '%.staff'`);

    const staffHash = await hashPassword("kips123");

    const realStaff = [
      { username: "ambreen.principal", name: "Ambreen", role: "admin" as const, subject: "Principal", phone: "03361170055", cnic: "42301-3648966-6", qualification: "BA/ADA", experience: 8, salary: 20000 },
      { username: "mfaisal.admin", name: "M.Faisal", role: "admin" as const, subject: "Admin Officer", phone: "03158870055", cnic: "13501-3053098-5", qualification: "BA/ADA", experience: 9, salary: 20000 },
      { username: "hammad.vp", name: "Muhammad Hammad", role: "admin" as const, subject: "Vice Principal", phone: "03109285748", cnic: "13501-8246232-5", qualification: "BA/ADA", experience: 7, salary: 15000 },
      { username: "emad.teacher", name: "Emad Ud Din Abbasi", role: "teacher" as const, subject: "Subject Teacher", phone: "03158681500", cnic: "13501-3542576-7", qualification: "BS", experience: 3, salary: 14000 },
      { username: "babar.teacher", name: "Babar Farooq", role: "teacher" as const, subject: "Senior Teacher", phone: "03195538767", cnic: "13501-8672929-3", qualification: "BA/ADA", experience: 7, salary: 8000 },
      { username: "ghazi.support", name: "Ghazi", role: "support" as const, subject: "Security Guard", phone: "03109039941", cnic: "13501-1305759-9", qualification: "Primary", experience: 8, salary: 8000 },
      { username: "abdullah.teacher", name: "Muhammad Abdullah", role: "teacher" as const, subject: "Senior Teacher", phone: "03146675432", cnic: "13501-3067895-7", qualification: "M.Ed", experience: 3, salary: 8000 },
      { username: "muneeba1.teacher", name: "Muneeba Bibi", role: "teacher" as const, subject: "Senior Teacher", phone: "03361170055", cnic: "13501-2636880-0", qualification: "Inter/HSSC", experience: 6, salary: 8000 },
      { username: "nosheen.teacher", name: "Nosheen Bibi", role: "teacher" as const, subject: "Teacher", phone: "03361170055", cnic: "42301-5534212-4", qualification: "Inter/HSSC", experience: 8, salary: 8000 },
      { username: "ayesha.teacher", name: "Ayesha Bibi", role: "teacher" as const, subject: "Subject Teacher", phone: "03361170055", cnic: "13501-0851670-2", qualification: "BS", experience: 3, salary: 7000 },
      { username: "noreen.teacher", name: "Bibi Noreen", role: "teacher" as const, subject: "Montessori Teacher", phone: "03361170055", cnic: "13501-3315125-8", qualification: "Matric/SSC", experience: 5, salary: 6000 },
      { username: "fatima1.teacher", name: "Fatima Bibi", role: "teacher" as const, subject: "Subject Teacher", phone: "03361170055", cnic: "13101-1801890-7", qualification: "Matric/SSC", experience: 2, salary: 6000 },
      { username: "irum.teacher", name: "Irum Shehzadi", role: "teacher" as const, subject: "Montessori Teacher", phone: "03361170055", cnic: "13501-3793177-0", qualification: "Matric/SSC", experience: 2, salary: 6000 },
      { username: "muneeba2.teacher", name: "Muneeba", role: "teacher" as const, subject: "Subject Teacher", phone: "03361170055", cnic: "13501-5746405-4", qualification: "Matric/SSC", experience: 3, salary: 6000 },
      { username: "sohaiba.teacher", name: "Sohaiba Sadique", role: "teacher" as const, subject: "Teacher", phone: "03361170055", cnic: "13501-6064090-8", qualification: "Inter/HSSC", experience: 1, salary: 6000 },
      { username: "fatima2.teacher", name: "Fatima Bibi (2)", role: "teacher" as const, subject: "Teacher", phone: "03426578547", cnic: "13101-9465008-4", qualification: "Matric/HSSC", experience: 1, salary: 5000 },
      { username: "attiqa.teacher", name: "Attiqa Mumtaj", role: "teacher" as const, subject: "Teacher", phone: "03456789765", cnic: "13501-6295424-0", qualification: "Inter/HSSC", experience: 1, salary: 4500 },
      { username: "mariyam.teacher", name: "Mariyam Sadique", role: "teacher" as const, subject: "Teacher", phone: "03426758765", cnic: "13501-2442465-6", qualification: "Matric/SSC", experience: 1, salary: 4500 },
      { username: "bushra.teacher", name: "Bushra Aziz", role: "teacher" as const, subject: "Teacher", phone: "03459627585", cnic: "13501-3053086-8", qualification: "Inter/HSSC", experience: 2, salary: 4000 },
      { username: "maira.internee", name: "Maira", role: "teacher" as const, subject: "Internee", phone: "03361170055", cnic: "13501-6160569-2", qualification: "Matric/SSC", experience: 0, salary: 4000 },
    ];

    for (const s of realStaff) {
      const exists = await client.query("SELECT id FROM staff WHERE username = $1", [s.username]);
      if (!exists.rows.length) {
        await client.query(`
          INSERT INTO staff (name, role, phone, subject, salary, status, username, address)
          VALUES ($1,$2,$3,$4,$5,'active',$6,$7)
        `, [s.name, s.role, s.phone, s.subject, s.salary, s.username, `CNIC: ${s.cnic} | ${s.qualification} | ${s.experience} yrs exp`]);
      }
      if (s.role === "teacher") {
        await client.query(`
          INSERT INTO users (username, password, role, name)
          VALUES ($1,$2,'teacher',$3)
          ON CONFLICT (username) DO NOTHING
        `, [s.username, staffHash, s.name]);
      }
    }
    console.log(`✓ ${realStaff.length} real staff seeded (password: kips123)`);

    // Students
    const studentHash = await hashPassword("kips123");
    const students = [
      { admNum: "KIPS-2026-1001", name: "Ali Hassan", father: "Muhammad Hassan", classId: classMap["Class 3"], section: "A", dob: "2015-05-10", gender: "male", phone: "0311-1111111", fee: 2500 },
      { admNum: "KIPS-2026-1002", name: "Sara Malik", father: "Khalid Malik", classId: classMap["Class 3"], section: "A", dob: "2015-08-22", gender: "female", phone: "0322-2222222", fee: 2500 },
      { admNum: "KIPS-2026-1003", name: "Omar Farooq", father: "Abdul Farooq", classId: classMap["Class 4"], section: "B", dob: "2014-03-15", gender: "male", phone: "0333-3333333", fee: 2800 },
      { admNum: "KIPS-2026-1004", name: "Zainab Iqbal", father: "Tariq Iqbal", classId: classMap["Class 5"], section: "A", dob: "2013-11-30", gender: "female", phone: "0344-4444444", fee: 3000 },
      { admNum: "KIPS-2026-1005", name: "Hamza Raza", father: "Imran Raza", classId: classMap["Class 6"], section: "A", dob: "2012-07-18", gender: "male", phone: "0355-5555555", fee: 3500 },
    ];

    const studentIds: number[] = [];
    for (const s of students) {
      if (!s.classId) continue;
      const username = s.name.toLowerCase().replace(/\s+/g, ".") + "." + s.admNum.split("-").pop();
      const existingS = await client.query("SELECT id FROM students WHERE admission_number = $1", [s.admNum]);
      let sid = existingS.rows[0]?.id;
      if (!sid) {
        const res = await client.query(`
          INSERT INTO students (admission_number, name, father_name, class_id, section, date_of_birth, gender, phone, fee_amount, status, username)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10)
          RETURNING id
        `, [s.admNum, s.name, s.father, s.classId, s.section, s.dob, s.gender, s.phone, s.fee, username]);
        sid = res.rows[0].id;
        await client.query(`
          INSERT INTO users (username, password, role, name)
          VALUES ($1,$2,'student',$3)
          ON CONFLICT (username) DO NOTHING
        `, [username, studentHash, s.name]);
      }
      studentIds.push(sid);
    }
    console.log(`✓ ${studentIds.length} students seeded (password: kips123)`);

    // Fee records
    const feeCount = await client.query("SELECT count(*) as cnt FROM fees");
    if (Number(feeCount.rows[0].cnt) === 0 && studentIds.length >= 3) {
      await client.query(`INSERT INTO fees (student_id, amount, paid_amount, month, due_date, status, paid_date, fine) VALUES ($1,2500,2500,'2026-05','2026-05-10','paid','2026-05-08',0)`, [studentIds[0]]);
      await client.query(`INSERT INTO fees (student_id, amount, paid_amount, month, due_date, status, fine) VALUES ($1,2500,0,'2026-05','2026-05-10','unpaid',500)`, [studentIds[1]]);
      await client.query(`INSERT INTO fees (student_id, amount, paid_amount, month, due_date, status, fine) VALUES ($1,2800,0,'2026-05','2026-05-10','unpaid',0)`, [studentIds[2]]);
      await client.query(`INSERT INTO fees (student_id, amount, paid_amount, month, due_date, status, paid_date, fine) VALUES ($1,2500,2500,'2026-04','2026-04-10','paid','2026-04-09',0)`, [studentIds[0]]);
      // Arrears - April unpaid for student 2
      await client.query(`INSERT INTO fees (student_id, amount, paid_amount, month, due_date, status, fine) VALUES ($1,2500,0,'2026-04','2026-04-10','unpaid',200)`, [studentIds[1]]);
      await client.query(`INSERT INTO fees (student_id, amount, paid_amount, month, due_date, status, fine) VALUES ($1,2800,1000,'2026-04','2026-04-10','partial',0)`, [studentIds[2]]);
      console.log("✓ Fee records seeded (including arrears)");
    }

    // Account entries
    const accCount = await client.query("SELECT count(*) as cnt FROM account_entries");
    if (Number(accCount.rows[0].cnt) === 0) {
      await client.query(`
        INSERT INTO account_entries (type, amount, category, description, date) VALUES
          ('income', 125000, 'Fee Collection', 'Monthly fee collection May 2026', '2026-05-10'),
          ('income', 15000, 'Admission Fee', 'New admissions May 2026', '2026-05-05'),
          ('income', 5000, 'Other', 'Library fines and misc', '2026-05-14'),
          ('expense', 95000, 'Salaries', 'Staff salaries May 2026', '2026-05-01'),
          ('expense', 12000, 'Utilities', 'Electricity and gas bills', '2026-05-08'),
          ('expense', 8000, 'Supplies', 'Stationery and supplies', '2026-05-12'),
          ('expense', 5500, 'Maintenance', 'Building maintenance', '2026-05-15')
      `);
      console.log("✓ Account entries seeded");
    }

    console.log("\n🎉 Seeding complete!");
    console.log("  Admin:   admin / admin123");
    console.log("  Teacher: emad.teacher / kips123");
    console.log("  Student: ali.hassan.1001 / kips123");

  } catch (err) {
    console.error("Error:", (err as Error).message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => { console.error(err); process.exit(1); });
