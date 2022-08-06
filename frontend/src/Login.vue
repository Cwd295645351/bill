<template>
    <div>登录页面</div>
</template>

<script>
import { log } from "@/utils/log";
export default {
    props: {},

    components: {},

    data() {
        return {};
    },

    computed: {},

    mounted() {
        log.default('>>> 默认信息');
        log.success('>>> 成功信息');
        log.warning('>>> 警告信息');
        log.danger('>>> 严重信息');
        log.primary('>>> 重要信息');
    },

    methods: {}
};
</script>
<style scoped></style>
