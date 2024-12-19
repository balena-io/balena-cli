import jsonwebtoken from 'jsonwebtoken';

const johnDoe = {
	username: 'johndoe1',
	email: 'johndoe@johndoe.com',
	gitlab_id: 1325,
	social_service_account: null,
	hasPasswordSet: true,
	public_key: false,
	features: [],
	id: 1344,
	intercomUserHash:
		'e03778dd29e157445f272acc921170cf2810b62f502645265cc349d6deda3524',
	permissions: [],
};
const janeDoe = {
	id: 152,
	username: 'janedoe',
	email: 'janedoe@asdf.com',
	social_service_account: null,
	has_disabled_newsletter: true,
	hasPasswordSet: true,
	public_key: false,
	features: [],
	intercomUserHash:
		'0b4f9eb44b371f0e328ef5fe03ad7eb2f5f72dd418ef23149d5287096558ce03',
	permissions: [],
};

export default {
	johndoe: {
		token: jsonwebtoken.sign(johnDoe, 'very-secret'),
	},
	janedoe: {
		token: jsonwebtoken.sign(janeDoe, 'very-secret'),
	},
};
