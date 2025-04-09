// EmailJS Template Setup Script
// This script provides a template for setting up EmailJS

console.log('EmailJS Template Setup Guide');
console.log('============================');
console.log('');
console.log('Follow these steps to set up EmailJS for the Cards of Cronos application:');
console.log('');
console.log('1. Create an EmailJS account at https://www.emailjs.com/');
console.log('');
console.log('2. Create a new Email Service:');
console.log('   - Go to Email Services tab');
console.log('   - Click "Add New Service"');
console.log('   - Select your email provider (Gmail, Outlook, etc.)');
console.log('   - Follow the authentication steps');
console.log('   - Name your service "cards_of_cronos"');
console.log('');
console.log('3. Create a new Email Template:');
console.log('   - Go to Email Templates tab');
console.log('   - Click "Create New Template"');
console.log('   - Name your template "card_request"');
console.log('   - Use the following template content:');
console.log('');
console.log('Subject: New Card Request: {{type}} - {{name}}');
console.log('');
console.log('Content:');
console.log(`
Hello,

A new card request has been submitted:

Card Details:
- Type: {{type}}
- Rarity: {{rarity}}
- Name: {{name}}
- Description: {{description}}

User Information:
- Email: {{email}}
- Social Link: {{socialLink}}

Transaction Details:
- Transaction Hash: {{transactionHash}}
- Burn Amount: {{burnAmount}} tokens

Image URL: {{imageUrl}}

Please review this request and process it accordingly.

Thank you,
Cards of Cronos System
`);
console.log('');
console.log('4. Get your EmailJS credentials:');
console.log('   - Go to Account > API Keys');
console.log('   - Copy your User ID');
console.log('   - Note your Service ID from the Email Services tab');
console.log('   - Note your Template ID from the Email Templates tab');
console.log('');
console.log('5. Update your .env.local file with these values:');
console.log('   NEXT_PUBLIC_EMAILJS_USER_ID=your-user-id');
console.log('   NEXT_PUBLIC_EMAILJS_SERVICE_ID=your-service-id');
console.log('   NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=your-template-id');
console.log('');
console.log('6. Test the email functionality in your application');
console.log('');
console.log('For more information, visit: https://www.emailjs.com/docs/');
