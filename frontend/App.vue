<template>
	<div>
		初始化项目
		<Login></Login>
	</div>
</template>

<script>
import Login from "./src/Login.vue";
export default {
	name: "app",
	props: {},

	components: { Login },

	data() {
		return {};
	},

	computed: {},

	mounted() {
		console.log("vue");
	},

	methods: {}
};
</script>
<style scoped></style>
