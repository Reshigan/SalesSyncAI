const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function checkPassword() {
  try {
    const user = await prisma.user.findFirst({
      where: { email: 'superadmin@salessync.com' }
    });
    
    if (user) {
      console.log('User found:', user.email);
      console.log('Stored hash:', user.password);
      
      // Test password
      const isValid = await bcrypt.compare('admin123', user.password);
      console.log('Password "admin123" is valid:', isValid);
      
      // Try other common passwords
      const testPasswords = ['password', 'superadmin', 'admin', '123456'];
      for (const pwd of testPasswords) {
        const valid = await bcrypt.compare(pwd, user.password);
        if (valid) {
          console.log(`Password "${pwd}" is valid!`);
        }
      }
    } else {
      console.log('User not found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPassword();