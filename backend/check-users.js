const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        company: {
          select: {
            name: true
          }
        }
      }
    });
    
    console.log('Users in database:');
    users.forEach(user => {
      console.log(`- ${user.email} (${user.role}) - ${user.firstName} ${user.lastName} - Company: ${user.company.name}`);
    });
    
    if (users.length === 0) {
      console.log('No users found in database');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();