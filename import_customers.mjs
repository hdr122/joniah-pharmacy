import mysql from 'mysql2/promise';
import fs from 'fs';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function importCustomers() {
  const connection = await mysql.createConnection(DATABASE_URL);

  try {
    console.log('📂 Reading customer data...');
    
    // Read the cleaned customer data
    const customersData = JSON.parse(
      fs.readFileSync('/home/ubuntu/customers_clean.json', 'utf-8')
    );

    console.log(`📊 Found ${customersData.length} customers to import`);
    console.log('');

    // Clear existing customers (optional - remove if you want to keep existing data)
    // await connection.execute('DELETE FROM customers');
    // console.log('🗑️  Cleared existing customers');

    let successCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;

    console.log('⏳ Importing customers...');
    
    // Import customers in batches for better performance
    const batchSize = 100;
    for (let i = 0; i < customersData.length; i += batchSize) {
      const batch = customersData.slice(i, i + batchSize);
      
      for (const customer of batch) {
        try {
          // Check if customer with same phone already exists
          const [existing] = await connection.execute(
            'SELECT id FROM customers WHERE phone = ?',
            [customer.phone]
          );

          if (existing.length > 0) {
            // Update existing customer
            await connection.execute(
              `UPDATE customers 
               SET name = ?, address1 = ?, updatedAt = NOW()
               WHERE phone = ?`,
              [customer.name, customer.address, customer.phone]
            );
            duplicateCount++;
          } else {
            // Insert new customer
            await connection.execute(
              `INSERT INTO customers (name, phone, address1, createdAt, updatedAt)
               VALUES (?, ?, ?, NOW(), NOW())`,
              [customer.name, customer.phone, customer.address]
            );
            successCount++;
          }
        } catch (error) {
          console.error(`❌ Error importing customer (row ${customer.row}):`, error.message);
          errorCount++;
        }
      }

      // Progress indicator
      const progress = Math.min(i + batchSize, customersData.length);
      const percentage = ((progress / customersData.length) * 100).toFixed(1);
      process.stdout.write(`\r   Progress: ${progress}/${customersData.length} (${percentage}%)`);
    }

    console.log('\n');
    console.log('✅ Import completed!');
    console.log(`   New customers added: ${successCount}`);
    console.log(`   Existing customers updated: ${duplicateCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Total processed: ${successCount + duplicateCount + errorCount}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

importCustomers().catch(console.error);
