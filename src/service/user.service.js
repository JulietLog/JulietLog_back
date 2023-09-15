import { profileRepository, userRepository, passwordRepository, blockRepository } from '@/repository';
import { validateSchema, sendVerificationMail, createToken, redisCli as redisClient, createPassword } from '@/utils';
import { customError } from '@/common/error';
import { StatusCodes } from 'http-status-codes';
import crypto from 'crypto';

const generateRandomString = (length) => {
    let result = '';
    const charset = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let i = 0; i < length; i++) {
        result += charset.charAt(crypto.randomInt(charset.length));
    }
    return result;
}

const generateRandomPassword = () => {
    let result = '';
    const charset = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    const specialCharset = "!@#$%^&*()";
    for (let i = 0; i < 6; i++) {
        result += charset.charAt(crypto.randomInt(charset.length));
    }
    for (let i = 0; i < 3; i++) {
        result += specialCharset.charAt(crypto.randomInt(specialCharset.length));
    }
    return result;
}

export const userService = {
    isEmailExists: async (email) => {
        try {
            await validateSchema.email.validateAsync(email);
            const user = await userRepository.findByEmail(email);
            if (user) {
                throw customError(StatusCodes.BAD_REQUEST, "Email Already exists.");
            }
        } catch (error) {
            throw customError(StatusCodes.INTERNAL_SERVER_ERROR, error.message);
        }
    },
    isNicknameExists: async (nickname) => {
        try {
            await validateSchema.nickname.validateAsync(nickname)
            const user = await userRepository.findByNickname(nickname);
            if (user) {
                throw customError(StatusCodes.BAD_REQUEST, "Nickname Already exists.");
            }
        } catch (error) {
            throw customError(StatusCodes.INTERNAL_SERVER_ERROR, error.message);
        }
    },
    getUserInformation: async (accessToken) => {
        try {
            const userId = profileRepository.findUserIdByToken(accessToken);
            return await profileRepository.findUserInformationById(userId);
        } catch (error) {
            throw customError(StatusCodes.INTERNAL_SERVER_ERROR, error.message);
        }
    },
    createUser: async (data) => {
        try {
            await validateSchema.signUp.validateAsync(data);
            const email = await userRepository.findByEmail(data.email);
            const nickname = await userRepository.findByNickname(data.nickname);
            if (email || nickname) {
                throw customError(StatusCodes.BAD_REQUEST, email ? `[Signup Error#1] Email Already exists.`
                        : `[Signup Error#2] Nickname Already exists.`);
            }
            const user = await userRepository.createUser(data);
            return {
                data: user,
                token: await createToken(user.userId) 
            }
        } catch (error) {
            if (error.name === "ValidationError") {
                throw customError(StatusCodes.BAD_REQUEST, `Data validation failed.`);
            }
            throw customError(StatusCodes.INTERNAL_SERVER_ERROR, error.message);
        }
    },
    updateUser: async (userId, data) => {
        try {
            const user = await profileRepository.findByUserId(userId);
            if (data.nickname) {
                await validateSchema.nickname.validateAsync(data.nickname);
                await profileRepository.updateProfile(userId, {
                    nickname: data.nickname,
                    imageUrl: user.dataValues.imageUrl
                });
            } else {
                await profileRepository.updateProfile(userId, {
                    nickname: user.dataValues.nickname,
                    imageUrl: data.imageUrl
                });
            }
        } catch (error) {
            if (error.name === "ValidationError") {
                throw customError(StatusCodes.BAD_REQUEST, 'Data validation failed.');
            }
            throw customError(StatusCodes.INTERNAL_SERVER_ERROR, error.message);
        }
    },
    deleteUser: async (userId) => {
        try {
            const count = await userRepository.deleteUser(userId);
            if (count === 0) {
                throw customError(StatusCodes.NOT_FOUND, "User not found");
            }
        } catch (error) {
            throw customError(StatusCodes.INTERNAL_SERVER_ERROR, error.message);
        }
    },
    updatePassword: async (userId, password) => {
        try {
            await validateSchema.password.validateAsync(password);
            await passwordRepository.updatePassword(userId, createPassword(password));
        } catch (error) {
            if (error.name === "ValidationError") {
                throw customError(StatusCodes.BAD_REQUEST, "Data validation failed.");
            }
            throw customError(StatusCodes.INTERNAL_SERVER_ERROR, error.message);
        }
    },
    sendPasswordResetMail: async (email) => {
        try {
            const user = await userRepository.findByEmail(email);
            if (!user || email.loginType !== 0) {
                throw customError(StatusCodes.BAD_REQUEST, 
                    !user ? "No users match this email" : 
                    `This feature is not available to social sign-up users.`);
            }
            const info = await sendVerificationMail(email, generateRandomString(6));
            if (info.error) {
                throw customError(StatusCodes.INTERNAL_SERVER_ERROR, "Failed to send mail.");
            }
        } catch (error) {
            throw customError(error.status || StatusCodes.INTERNAL_SERVER_ERROR, error.message);
        }
    },
    verificationMailHandler: async (email, code) => {
        try {
            const result = await redisClient.get(email);
            const password = generateRandomPassword();
            if (result === code) {
                const user = await userRepository.findByEmail(email);
                await passwordRepository.updatePassword(user.userId, createPassword(password));
                return password;
            }
            throw customError(StatusCodes.BAD_REQUEST, "Authentication code does not match.");
        } catch (error) {
            throw customError(StatusCodes.INTERNAL_SERVER_ERROR, error.message);
        }
    },
    blockUser: async (userId, blockUserId) => {
        try {
            if (!userId || !blockUserId) {
                throw customError(StatusCodes.UNPROCESSABLE_ENTITY, `Missing request body "id".`);
            }
            const validate = await blockRepository.isBlocked(userId, blockUserId);
            if (validate) {
                if (validate === -1) {
                    throw customError(StatusCodes.BAD_REQUEST, "No user found that you block off.");
                }
                throw customError(StatusCodes.CONFLICT, "Already blocked user.");
            }
            const data = await blockRepository.block(userId, blockUserId);
            return data.dataValues.blockUserId;
        } catch (error) {
            throw customError(error.status || StatusCodes.INTERNAL_SERVER_ERROR, error.message);
        }
    },
    getBlockUsers: async () => {

    }
}