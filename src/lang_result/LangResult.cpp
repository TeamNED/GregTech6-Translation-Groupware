#include "LangResult.hpp"

LangResult::LangResult(shared_ptr<IGeneratorMeta> meta) : _meta(meta) {}
shared_ptr<IGeneratorMeta> LangResult::meta() { return this->_meta; }