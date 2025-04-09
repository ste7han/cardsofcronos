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
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};
