#include "Generator.hpp"

Generator::Generator(shared_ptr<IGeneratorMeta> meta) : _meta(meta){};

shared_ptr<IGeneratorMeta> &Generator::meta() { return this->_meta; }