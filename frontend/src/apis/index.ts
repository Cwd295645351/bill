import axios from "axios"
import { getConfig } from "@/utils/config"

const config = getConfig()

const version = config.version

const REFRESHING_TOKEN = `/api/${version}/common/refreshToken` // 刷新token
const LOGOUT = `/api/${version}/common/logout` // 退出登录


const instance = axios.create({
	baseURL: config.baseURL
})

// 刷新token
export const refreshToken = (refreshToken: string) => {
	return instance.put(REFRESHING_TOKEN, { refreshToken })
}

// 退出登录
export const logout = () => {
	return instance.post(LOGOUT)
}
