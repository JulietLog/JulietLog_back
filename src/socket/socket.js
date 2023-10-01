import {socketService} from "@/service/socket.service";
import {redisCli as redisClient} from "@/utils";

const event = {
    connection: 'connection',
    disconnect: 'disconnect',
    info: 'info',
    error: 'error',
    join: 'join',
    message: 'message',
    status: 'status',
    ban: 'ban',
    unban: 'unban',
    discussionProgress: 'discussionProgress',
    history: 'history'
}

Object.freeze(event);

export const socket = (io) => {
    io.on(event.connection, async (socket) => {
        try {
            const verifyResult = await socketService.isAuthenticated(socket);

            if (!verifyResult.error) {
                const userKey = `chat:nickname:${verifyResult.nickname}:socketId`;
                await redisClient.set(userKey, socket.id);
                socket.user = verifyResult;
            }

            // 채팅 참여
            socket.on(event.join, async (data) => {
                const {discussionId} = data;

                // discussionid 검증
                const discussion = await socketService.validateDiscussionId(discussionId);
                if (!discussion) {
                    io.to(socket.id).emit(event.error, {message: '존재하지 않는 토의입니다.'});
                    return;
                }

                // 모든 유저에게 참여중인 유저 status 전송
                if (socket.user) {
                    const checkUser = await socketService.checkDiscussionUser(discussionId, socket.user.userId);
                    if (checkUser.error) {
                        // 강퇴 유저 에러처리
                        io.to(socket.id).emit(event.error, {message: '강퇴당한 유저입니다.'});
                    } else {
                        // 토의 참여 완료
                        socket.join(discussionId);
                    }
                }


                // 토의 참여자 리스트 반환
                const discussionUsers = await socketService.getDiscussionUsers(discussionId);
                discussionUsers.discussionId = discussionId;    // todo 이거 뭐지
                // todo 비로그인 접속 시 참여자 리스트 업데이트x
                io.to(discussionId).emit(event.status, discussionUsers);

                // 헤당 유저에게 이전 채팅 내용 전송
                // todo 조회 로직 추가
                io.to(socket.id).emit(event.history, {messages: ['이전 채팅 내역']});


                // 유저 참여했다고 모든 유저들에게 메세지 전송
                if (socket.user) {
                    io.to(discussionId).emit(event.info, `${socket.user.nickname} 님이 채팅에 참여하셨습니다.`);
                }
            });

            // 채팅 메세지
            socket.on(event.message, (data) => {
                const {discussionId, jwt, message} = data;

                // jwt 검증
                const nickname = '';

                // 채팅 저장
                const {messageId, createdAt} = '';

                // 채팅 모든 유저에게 전송
                const res = {
                    discussionId,
                    nickname,
                    messageId,
                    message,
                    createdAt,
                }

                io.to(discussionId).emit(event.message, res);
            });

            // 토의 진행 현황 업데이트
            socket.on(event.discussionProgress, async (data) => {
                const {discussionId, progress} = data;

                // discussionid 검증
                const discussion = await socketService.validateDiscussionId(discussionId);
                if (!discussion) {
                    io.to(socket.id).emit(event.error, {message: '존재하지 않는 토의입니다.'});
                    return;
                }

                // 작성자인지 확인
                const isAuthor = await socketService.verifyUser(discussionId, socket);
                if (!isAuthor) {
                    io.to(socket.id).emit(event.error, {message: '작성자가 아닙니다.'});
                    return;
                }

                // 진행현황 저장 (추후 업데이트 시간 추가)
                await socketService.updateDiscussionProgress(discussionId, progress);

                // 모든 유저에게 전송
                const res = {
                    discussionId,
                    progress
                }

                io.to(discussionId).emit(event.discussionProgress, res);
            });

            // 참여자/강퇴자 조회
            socket.on(event.status, async (data) => {
                const {discussionId} = data;
                const discussionUsers = await socketService.getDiscussionUsers(discussionId);
                discussionUsers.discussionId = discussionId;
                io.to(socket.id).emit(event.status, discussionUsers);
            });

            // 강퇴
            socket.on(event.ban, async (data) => {
                const {discussionId, nickname} = data;

                // discussionid 검증
                const discussion = await socketService.validateDiscussionId(discussionId);
                if (!discussion) {
                    io.to(socket.id).emit(event.error, {message: '존재하지 않는 토의입니다.'});
                    return;
                }

                // 작성자인지 확인
                const isAuthor = await socketService.verifyUser(discussionId, socket);
                if (!isAuthor) {
                    io.to(socket.id).emit(event.error, {message: '작성자가 아닙니다.'});
                    return;
                }
                const result = await socketService.banDiscussionUser(discussionId, socket.user.userId, nickname);

                // 해당 유저 강퇴
                // 유저별 socket.id 저장해야함
                const userKey = `chat:nickname:${nickname}:socketId`;
                await redisClient.get(userKey);
                const targetSocketId = await redisClient.get(userKey);
                io.to(targetSocketId).emit(event.error, {message: `해당 토의방에서 강퇴되었습니다.`});
                socket.leave(targetSocketId);
                // 비정상 단절때도 요소 삭제 필요

                // 작성자에게 강퇴했다고 안내메세지 전송
                io.to(socket.id).emit(event.info, {message: `[${nickname}] 유저를 강퇴했습니다.`});

                // 참여자/강퇴자 리스트 전송
                const discussionUsers = await socketService.getDiscussionUsers(discussionId);
                discussionUsers.discussionId = discussionId;
                io.to(discussionId).emit(event.status, discussionUsers);
            });

            // 강퇴 취소
            socket.on(event.unban, async (data) => {
                const {discussionId, nickname} = data;

                // discussionid 검증
                const discussion = await socketService.validateDiscussionId(discussionId);
                if (!discussion) {
                    io.to(socket.id).emit(event.error, {message: '존재하지 않는 토의입니다.'});
                    return;
                }

                // 작성자인지 확인
                const isAuthor = await socketService.verifyUser(discussionId, socket);
                if (!isAuthor) {
                    io.to(socket.id).emit(event.error, {message: '작성자가 아닙니다.'});
                    return;
                }

                const result = await socketService.unbanDiscussionUser(discussionId, socket.user.userId, nickname);

                // 해당 유저 강퇴
                // 유저별 socket.id 저장해야함

                // 작성자에게 강퇴 취소했다고 안내메세지 전송
                io.to(socket.id).emit(event.info, {message: `[${nickname}] 유저의 강퇴를 취소했습니다.`});

                // 참여자/강퇴자 리스트 전송
                const discussionUsers = await socketService.getDiscussionUsers(discussionId);
                discussionUsers.discussionId = discussionId;
                io.to(discussionId).emit(event.status, discussionUsers);
            });

            // 연결 끊김
            socket.on(event.disconnect, async () => {
                // 짧은 시간 동안 인터넷 연결이 끊길 수 있음 -> heartBeat 이벤트 사용
                if (socket.user) {
                    const userKey = `chat:nickname:${socket.user.nickname}:socketId`;
                    await redisClient.del(userKey);
                }
            });
        }catch (error) {
            console.error(error);
        }
    });
};