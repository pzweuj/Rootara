from pocketbase import PocketBase
from typing import Optional, Dict, Any
import logging

class RootaraUser:
    def __init__(self, pb_url: str):
        """
        初始化RootaraUser类
        
        Args:
            pb_url: PocketBase服务器URL
        """
        self.client = PocketBase(pb_url)
        self.logger = logging.getLogger(__name__)

    async def create_user(self, email: str, password: str, username: str, additional_data: Optional[Dict[str, Any]] = None) -> Dict:
        """
        创建新用户
        
        Args:
            email: 用户邮箱
            password: 用户密码
            username: 用户名
            additional_data: 额外的用户数据（可选）
            
        Returns:
            Dict: 创建的用户信息
        """
        try:
            user_data = {
                "email": email,
                "password": password,
                "passwordConfirm": password,
                "username": username
            }
            
            if additional_data:
                user_data.update(additional_data)
                
            result = await self.client.collection("users").create(user_data)
            self.logger.info(f"Successfully created user: {email}")
            return result
            
        except Exception as e:
            self.logger.error(f"Failed to create user: {str(e)}")
            raise

    async def authenticate_user(self, email: str, password: str) -> Dict:
        """
        用户认证
        
        Args:
            email: 用户邮箱
            password: 用户密码
            
        Returns:
            Dict: 认证成功的用户信息
        """
        try:
            auth_data = await self.client.collection("users").auth_with_password(email, password)
            self.logger.info(f"User authenticated: {email}")
            return auth_data
            
        except Exception as e:
            self.logger.error(f"Authentication failed: {str(e)}")
            raise

    async def update_user(self, user_id: str, update_data: Dict[str, Any]) -> Dict:
        """
        更新用户信息
        
        Args:
            user_id: 用户ID
            update_data: 要更新的用户数据
            
        Returns:
            Dict: 更新后的用户信息
        """
        try:
            result = await self.client.collection("users").update(user_id, update_data)
            self.logger.info(f"Successfully updated user: {user_id}")
            return result
            
        except Exception as e:
            self.logger.error(f"Failed to update user: {str(e)}")
            raise

    async def delete_user(self, user_id: str) -> bool:
        """
        删除用户
        
        Args:
            user_id: 要删除的用户ID
            
        Returns:
            bool: 删除是否成功
        """
        try:
            await self.client.collection("users").delete(user_id)
            self.logger.info(f"Successfully deleted user: {user_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to delete user: {str(e)}")
            raise

    async def reset_password(self, email: str) -> bool:
        """
        发送密码重置邮件
        
        Args:
            email: 用户邮箱
            
        Returns:
            bool: 重置邮件是否发送成功
        """
        try:
            await self.client.collection("users").request_password_reset(email)
            self.logger.info(f"Password reset email sent to: {email}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to send password reset email: {str(e)}")
            raise

    async def get_user_by_id(self, user_id: str) -> Dict:
        """
        通过ID获取用户信息
        
        Args:
            user_id: 用户ID
            
        Returns:
            Dict: 用户信息
        """
        try:
            result = await self.client.collection("users").get_one(user_id)
            return result
            
        except Exception as e:
            self.logger.error(f"Failed to get user: {str(e)}")
            raise