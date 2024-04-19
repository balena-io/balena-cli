import * as jsonwebtoken from 'jsonwebtoken';

const johnDoe = {
	id: 1344,
	actor: 1344,
	jwt_secret: '1344',
};

const janeDoe = {
	id: 152,
	actor: 152,
	jwt_secret: '152',
};

export default {
	johndoe: {
		token: jsonwebtoken.sign(johnDoe, 'very-secret'),
	},
	janedoe: {
		token: jsonwebtoken.sign(janeDoe, 'very-secret'),
	},
};
