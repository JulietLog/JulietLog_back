import express from 'express';
import {discussionController} from '@/controller/discussion.controller';

const router = express.Router();
import { isAuthenticated, isAuthorized } from "@/middleware";

router.post('/discussions', isAuthorized, discussionController.createDiscussion);
router.patch('/discussions/:discussionId', isAuthorized, discussionController.updatediscussion);

export default router;