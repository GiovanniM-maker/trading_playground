import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import * as readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function main() {
  try {
    console.log('Creating admin user...\n');
    
    const email = await question('Email: ');
    const password = await question('Password: ');
    const role = await question('Role (default: admin): ') || 'admin';
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role,
      },
    });
    
    console.log(`\n✅ Admin user created successfully!`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   ID: ${user.id}\n`);
  } catch (error: any) {
    if (error.code === 'P2002') {
      console.error('\n❌ Error: User with this email already exists');
    } else {
      console.error('\n❌ Error creating user:', error.message);
    }
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main();

