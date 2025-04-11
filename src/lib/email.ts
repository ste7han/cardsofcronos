import emailjs from '@emailjs/browser';

// Initialize EmailJS with your user ID
export const initEmailJS = () => {
  emailjs.init(process.env.NEXT_PUBLIC_EMAILJS_USER_ID || '');
};

// Send an email notification for a new card request
export const sendCardRequestEmail = async (
  cardType: string,
  rarity: string,
  name: string,
  description: string,
  socialLink: string,
  imageUrl: string,
  transactionHash: string,
  burnAmount: number,
  email: string
) => {
  try {
    // TESTING MODE: Email functionality temporarily disabled
    console.log('Email sending disabled for testing. Would have sent the following data:');
    console.log({
      card_type: cardType,
      rarity: rarity,
      name: name,
      description: description,
      social_link: socialLink,
      image_url: imageUrl,
      transaction_hash: transactionHash,
      burn_amount: burnAmount,
      email: email,
      to_email: 'cardsofcronos@gmail.com',
    });
    
    // Return a mock successful response
    return { status: 200, text: 'OK - Email disabled for testing' };
    
    /* PRODUCTION CODE (commented out for testing):
    const response = await emailjs.send(
      process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || '',
      process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || '',
      {
        card_type: cardType,
        rarity: rarity,
        name: name,
        description: description,
        social_link: socialLink,
        image_url: imageUrl,
        transaction_hash: transactionHash,
        burn_amount: burnAmount,
        email: email,
        to_email: 'cardsofcronos@gmail.com',
      }
    );
    
    return response;
    */
  } catch (error) {
    console.error('Email would have failed to send:', error);
    // Instead of throwing the error, return a mock response so the process can continue
    return { status: 200, text: 'OK - Email disabled for testing' };
  }
};
